/** Fluid scene layout — scaling handled in CSS (responsive grid + hub rotation). */
const DEFAULT_TARGET_WEIGHT_KG = 50;
const MIN_TARGET_WEIGHT_KG = 5;
const MAX_TARGET_WEIGHT_KG = 100;

const COMMANDS = {
    modeLocal: 'cmd_mode_local',
    modeCentral: 'cmd_mode_central',
    marche: 'cmd_marche',
    arret: 'cmd_arret',
    reset: 'cmd_reset_alarmes',
    sac: 'cmd_presence_sac',
    au: 'cmd_arret_urgence',
    targetWeight: 'cmd_set_target_weight',
};

const DATA_KEYS = {
    weight: 'weight',
    targetWeight: 'target_weight',
    motorEnsacheuse: 'motor_ensacheuse',
    motorBande: 'motor_bande',
    activeSpout: 'active_spout',
    angle: 'angle',
    bagsProducedCounter: 'Bags_Produced_Counter',
    modeLocal: 'mode_local',
    modeCentral: 'mode_central',
    defaut: 'defaut',
    au: 'arret_urgence',
    defautEcoulement: 'defaut_ecoulement',
    defautCapteur: 'defaut_capteur',
    defautMoteur: 'defaut_moteur',
    defautDejoncteur: 'defaut_dejoncteur',
};

/** Legacy: `#token=jwt` for cold-open / bookmarks (prefer dashboard embed + postMessage). */
function resolveAuthTokenFromHash() {
    try {
        const rawHash = window.location.hash || '';
        const normalizedHash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
        const params = new URLSearchParams(normalizedHash);
        const token = params.get('token');
        return typeof token === 'string' && token.trim() ? token.trim() : null;
    } catch {
        return null;
    }
}

/** Optional origins from dashboard postMessage (parentOrigins). */
let postMessageParentOrigins = [];

function getAllowedParentOrigins() {
    const fromGlobal = Array.isArray(window.__PFE_NATIVE_PARENT_ORIGINS__)
        ? window.__PFE_NATIVE_PARENT_ORIGINS__.filter((o) => typeof o === 'string' && o.length > 0)
        : [];
    return [...fromGlobal, ...postMessageParentOrigins];
}

function isParentPostMessageOriginAllowed(origin) {
    if (typeof origin !== 'string' || !origin) {
        return false;
    }
    if (origin === window.location.origin) {
        return true;
    }
    if (getAllowedParentOrigins().includes(origin)) {
        return true;
    }
    try {
        if (document.referrer) {
            return new URL(document.referrer).origin === origin;
        }
    } catch {
        return false;
    }
    return false;
}

let accessToken = resolveAuthTokenFromHash();

function applyAccessToken(token) {
    const next = typeof token === 'string' && token.trim() ? token.trim() : null;
    if (!next) {
        return;
    }
    accessToken = next;
    setupSocket();
}

let parentAuthListenerAttached = false;

function registerParentAuthMessageListener() {
    if (parentAuthListenerAttached) {
        return;
    }
    parentAuthListenerAttached = true;
    window.addEventListener('message', (event) => {
        if (window.parent === window || !event.source || event.source !== window.parent) {
            return;
        }
        if (!isParentPostMessageOriginAllowed(event.origin)) {
            return;
        }
        const payload = event.data;
        if (!payload || typeof payload !== 'object') {
            return;
        }
        if (payload.type !== 'pfe-native-auth') {
            return;
        }
        if (Array.isArray(payload.parentOrigins)) {
            postMessageParentOrigins = payload.parentOrigins.filter(
                (o) => typeof o === 'string' && o.length > 0
            );
        }
        if (typeof payload.token !== 'string' || !payload.token.trim()) {
            return;
        }
        applyAccessToken(payload.token);
    });
}

registerParentAuthMessageListener();

const state = {
    connected: false,
    socketConnected: false,
    liveWeight: 0,
    targetWeight: DEFAULT_TARGET_WEIGHT_KG,
    angleDeg: 0,
    modeLocal: false,
    modeCentral: false,
    motorEnsacheuse: false,
    motorBande: false,
    bagsProducedCounterPrev: null,
    pendingDrops: 0,
    faultGlobal: false,
    faults: {
        au: false,
        ecoulement: false,
        capteur: false,
        moteur: false,
        dejoncteur: false,
    },
    sacCount: 0,
    activeSpout: null,
    bags: Array.from({ length: 8 }, () => ({
        occupied: false,
        trackingLive: false,
        readyToDrop: false,
        weight: 0,
        snapshotWeight: 0,
    })),
};

const dom = {};
let socket = null;

document.addEventListener('DOMContentLoaded', () => {
    cacheDom();
    buildSpouts();
    bindEvents();
    resizeStage();
    window.addEventListener('resize', resizeStage);
    if (typeof ResizeObserver === 'function' && dom.stageWrap) {
        const ro = new ResizeObserver(() => {
            resizeStage();
        });
        ro.observe(dom.stageWrap);
    }
    requestAnimationFrame(() => {
        resizeStage();
    });
    if (accessToken) {
        setupSocket();
    } else {
        log('Authentification: en attente du tableau de bord (postMessage) ou jeton URL (#token=).');
    }
    updateUI();
});

function cacheDom() {
    dom.stageWrap = document.getElementById('stage');
    dom.packer = document.getElementById('packer');
    dom.belt = document.getElementById('belt-anim');
    dom.worker = document.getElementById('worker');
    dom.c10 = document.getElementById('c10-led');
    dom.becsContainer = document.getElementById('becs-container');
    dom.systemStatus = document.getElementById('system-status');
    dom.screen = document.getElementById('main-screen');

    dom.txtMode = document.getElementById('txt-mode');
    dom.txtState = document.getElementById('txt-state');
    dom.txtWeight = document.getElementById('txt-weight');
    dom.txtTarget = document.getElementById('txt-target');
    dom.txtTargetLive = document.getElementById('txt-target-live');
    dom.txtFault = document.getElementById('txt-fault');
    dom.txtCount = document.getElementById('txt-count');

    dom.vAu = document.getElementById('v-au');
    dom.vEco = document.getElementById('v-eco');
    dom.vMot = document.getElementById('v-mot');
    dom.vCap = document.getElementById('v-cap');
    dom.vDis = document.getElementById('v-dis');

    dom.btnModeLocal = document.getElementById('btn-mode-local');
    dom.btnModeCentral = document.getElementById('btn-mode-central');
    dom.btnMarcheCentral = document.getElementById('btn-marche-central');
    dom.btnArretCentral = document.getElementById('btn-arret-central');
    dom.btnAcquittement = document.getElementById('btn-acquittement');
    dom.btnMettreSac = document.getElementById('btn-mettre-sac');
    dom.btnAu = document.getElementById('btn-au');
    dom.btnClear = document.getElementById('btn-clear');
    dom.btnApplyTarget = document.getElementById('btn-apply-target');
    dom.targetInput = document.getElementById('target-input');
}

function buildSpouts() {
    if (!dom.becsContainer) return;

    dom.becsContainer.innerHTML = '';

    for (let i = 0; i < 8; i++) {
        const bec = document.createElement('div');
        bec.className = 'bec-unit';
        bec.style.transform = `rotate(${i * 45}deg) translateY(calc(-1 * var(--bec-rim)))`;
        bec.innerHTML = `
            <div class="spout-id">${i + 1}</div>
            <div class="presence-voyant" id="pv-${i}"></div>
            <div class="weight-display-bec" id="mini-wd-${i}">0.0</div>
            <div class="valve" id="v-${i}"></div>
            <div class="sac-realist" id="sm-${i}">
                <div class="cement-fill" id="fill-${i}"></div>
            </div>
        `;

        dom.becsContainer.appendChild(bec);
    }
}

function updateSpoutCardAppearance(index) {
    const card = document.getElementById(`spout-card-${index}`);
    const bag = state.bags[index];
    if (!card || !bag) return;

    const target = clampTargetWeight(state.targetWeight);

    card.classList.remove('spout-card--empty', 'spout-card--present', 'spout-card--filling', 'spout-card--full');

    if (!bag.occupied) {
        card.classList.add('spout-card--empty');
        return;
    }

    if (bag.readyToDrop || bag.weight >= target * 0.98) {
        card.classList.add('spout-card--full');
        return;
    }

    if (bag.trackingLive || (bag.weight > 0 && bag.weight < target)) {
        card.classList.add('spout-card--filling');
        return;
    }

    card.classList.add('spout-card--present');
}

function updateAllSpoutCards() {
    for (let i = 0; i < 8; i++) {
        updateSpoutCardAppearance(i);
    }
}

function bindEvents() {
    dom.btnModeLocal.addEventListener('click', () => setMode('LOCAL'));
    dom.btnModeCentral.addEventListener('click', () => setMode('CENTRAL'));
    dom.btnMarcheCentral.addEventListener('click', marcheCentral);
    dom.btnArretCentral.addEventListener('click', arretCentral);
    dom.btnAcquittement.addEventListener('click', acquittement);
    dom.btnMettreSac.addEventListener('click', mettreSac);
    dom.btnAu.addEventListener('click', declencherAU);
    dom.btnClear.addEventListener('click', clearPallet);
    dom.btnApplyTarget.addEventListener('click', applyTargetWeight);

    dom.targetInput.addEventListener('change', () => {
        const value = clampTargetWeight(asNumber(dom.targetInput.value));
        dom.targetInput.value = value.toFixed(1);
    });
}

function setupSocket() {
    if (typeof window.io !== 'function') {
        log('Client Socket.IO indisponible');
        return;
    }

    if (!accessToken) {
        return;
    }

    if (socket) {
        try {
            socket.removeAllListeners();
        } catch (_e) {
            //
        }
        try {
            socket.disconnect();
        } catch (_e2) {
            //
        }
        socket = null;
    }

    socket = window.io({
        auth: { token: accessToken },
    });

    socket.on('connect', () => {
        state.socketConnected = true;
        log('Passerelle connectee');
        updateUI();
    });

    socket.on('disconnect', (reason) => {
        state.socketConnected = false;
        state.connected = false;
        stopMachineVisuals();
        updateUI();
        log(`Passerelle deconnectee: ${reason}`);
    });

    socket.on('connect_error', (error) => {
        state.socketConnected = false;
        state.connected = false;
        stopMachineVisuals();
        updateUI();
        log(`Erreur socket: ${error.message}`);
    });

    socket.on('plc-status', (status) => {
        const nextConnected = Boolean(status && status.connected);
        if (state.connected !== nextConnected) {
            log(nextConnected ? 'Communication PLC etablie' : 'Perte communication PLC');
        }

        state.connected = nextConnected;
        if (!nextConnected) {
            stopMachineVisuals();
        }

        updateUI();
    });

    socket.on('telemetry', (payload) => {
        applyTelemetry(payload);
    });

    socket.on('telemetry_update', (payload) => {
        applyTelemetry(payload);
    });
}

function resizeStage() {
    document.documentElement.style.removeProperty('--stage-scale');
}

async function setMode(mode) {
    const command = mode === 'LOCAL' ? COMMANDS.modeLocal : COMMANDS.modeCentral;

    try {
        await postMachineCommand(command);
        log(`Mode ${mode} envoye`);
    } catch (error) {
        handlePostError(error, `Mode ${mode}`);
    }
}

async function marcheCentral() {
    if (!state.modeCentral || state.modeLocal) {
        log('Commande MARCHE bloquee: mode non CENTRAL');
        return;
    }

    try {
        await postMachineCommand(COMMANDS.marche);
        log('Commande MARCHE CENTRAL envoyee');
    } catch (error) {
        handlePostError(error, 'MARCHE CENTRAL');
    }
}

async function arretCentral() {
    if (!state.modeCentral || state.modeLocal) {
        log('Commande ARRET bloquee: mode non CENTRAL');
        return;
    }

    try {
        await postMachineCommand(COMMANDS.arret);
        log('Commande ARRET CENTRAL envoyee');
    } catch (error) {
        handlePostError(error, 'ARRET CENTRAL');
    }
}

async function declencherAU() {
    try {
        await postMachineCommand(COMMANDS.au);
        log('Commande ARRET URGENCE envoyee');
    } catch (error) {
        handlePostError(error, 'ARRET URGENCE');
    }
}

async function acquittement() {
    try {
        await postMachineCommand(COMMANDS.reset);
        log('Commande ACQUITTEMENT envoyee');
    } catch (error) {
        handlePostError(error, 'ACQUITTEMENT');
    }
}

async function mettreSac() {
    try {
        await postMachineCommand(COMMANDS.sac);
        log('Commande PRESENCE SAC envoyee');
    } catch (error) {
        handlePostError(error, 'METTRE SAC');
    }
}

async function applyTargetWeight() {
    const value = clampTargetWeight(asNumber(dom.targetInput.value));
    dom.targetInput.value = value.toFixed(1);

    try {
        await postMachineCommand(COMMANDS.targetWeight, Number(value.toFixed(1)));
        state.targetWeight = value;
        log(`Consigne poids envoyee: ${value.toFixed(1)} kg`);
        updateUI();
    } catch (error) {
        handlePostError(error, 'CONSIGNE POIDS');
    }
}

async function postMachineCommand(command, value) {
    const payload = { command };
    if (value !== undefined) {
        payload.value = value;
    }

    const headers = {
        'Content-Type': 'application/json',
    };

    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    const response = await fetch('/api/machine/command', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let message = `HTTP ${response.status}`;

        try {
            const result = await response.json();
            if (result && typeof result.error === 'string' && result.error.trim()) {
                message = result.error;
            }
        } catch (_error) {
            // Keep default HTTP message if body is not valid JSON.
        }

        throw new Error(message);
    }
}

function clearPallet() {
    document.querySelectorAll('.stacked-sac').forEach((node) => node.remove());

    resetBagStates();

    state.sacCount = 0;
    state.bagsProducedCounterPrev = null;
    state.pendingDrops = 0;
    dom.txtCount.textContent = '0';
    log('Palette videe');
}

function resetBagStates() {
    for (let i = 0; i < state.bags.length; i++) {
        state.bags[i].occupied = false;
        state.bags[i].trackingLive = false;
        state.bags[i].readyToDrop = false;
        state.bags[i].weight = 0;
        state.bags[i].snapshotWeight = 0;
        clearSpoutVisual(i);
    }

    state.activeSpout = null;
}

function applyTelemetry(plcData) {
    if (!plcData || typeof plcData !== 'object') {
        return;
    }

    state.connected = true;
    state.liveWeight = asNumber(plcData[DATA_KEYS.weight]);
    state.angleDeg = normalizeAngle(asNumber(plcData[DATA_KEYS.angle]));

    const rawTargetWeight = plcData[DATA_KEYS.targetWeight];
    if (rawTargetWeight !== undefined && rawTargetWeight !== null && rawTargetWeight !== '') {
        state.targetWeight = clampTargetWeight(asNumber(rawTargetWeight));
        syncTargetControlsFromPlc();
    }

    const plcActiveSpout = parsePlcSpoutIndex(plcData[DATA_KEYS.activeSpout]);
    syncActiveSpoutFromPlc(plcActiveSpout);

    const nextProducedCounter = Math.max(0, Math.floor(asNumber(plcData[DATA_KEYS.bagsProducedCounter])));
    processProducedCounter(nextProducedCounter);

    state.modeLocal = asBool(plcData[DATA_KEYS.modeLocal]);
    state.modeCentral = asBool(plcData[DATA_KEYS.modeCentral]);
    state.motorEnsacheuse = asBool(plcData[DATA_KEYS.motorEnsacheuse]);
    state.motorBande = asBool(plcData[DATA_KEYS.motorBande]);

    state.faults.au = asBool(plcData[DATA_KEYS.au]);
    state.faults.ecoulement = asBool(plcData[DATA_KEYS.defautEcoulement]);
    state.faults.capteur = asBool(plcData[DATA_KEYS.defautCapteur]);
    state.faults.moteur = asBool(plcData[DATA_KEYS.defautMoteur]);
    state.faults.dejoncteur = asBool(plcData[DATA_KEYS.defautDejoncteur]);

    const anyDetailedFault = state.faults.au
        || state.faults.ecoulement
        || state.faults.capteur
        || state.faults.moteur
        || state.faults.dejoncteur;
    state.faultGlobal = asBool(plcData[DATA_KEYS.defaut]) || anyDetailedFault;

    applyMotionFromState();
    updateUI();
}

function stopMachineVisuals() {
    state.motorEnsacheuse = false;
    state.motorBande = false;
    state.angleDeg = 0;
    applyMotionFromState();
}

function asBool(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1';
    }
    return false;
}

function asNumber(value) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function clampTargetWeight(value) {
    if (!Number.isFinite(value) || value === 0) {
        return DEFAULT_TARGET_WEIGHT_KG;
    }

    return Math.max(MIN_TARGET_WEIGHT_KG, Math.min(MAX_TARGET_WEIGHT_KG, value));
}

function normalizeAngle(value) {
    if (!Number.isFinite(value)) return 0;
    const normalized = value % 360;
    return normalized < 0 ? normalized + 360 : normalized;
}

function parsePlcSpoutIndex(value) {
    const parsed = Math.floor(asNumber(value));
    if (parsed >= 1 && parsed <= state.bags.length) {
        return parsed - 1;
    }
    return null;
}

function syncTargetControlsFromPlc() {
    const active = document.activeElement;
    if (active === dom.targetInput) {
        return;
    }

    dom.targetInput.value = state.targetWeight.toFixed(1);
}

function syncActiveSpoutFromPlc(plcSpoutIndex) {
    const previousActive = state.activeSpout;

    if (previousActive !== null && previousActive !== plcSpoutIndex) {
        markBagReadyForDrop(previousActive);
    }

    state.activeSpout = plcSpoutIndex;

    if (plcSpoutIndex === null) {
        return;
    }

    const bag = state.bags[plcSpoutIndex];
    if (!bag) {
        return;
    }

    if (previousActive !== plcSpoutIndex) {
        animateWorker();
        log(`Bec actif PLC: ${plcSpoutIndex + 1}`);
    }

    bag.occupied = true;
    bag.trackingLive = true;
    bag.readyToDrop = false;
    bag.weight = state.liveWeight;
    if (bag.snapshotWeight <= 0) {
        bag.snapshotWeight = state.liveWeight;
    }

    showSpoutBag(plcSpoutIndex, true);
}

function showSpoutBag(index, valveOn) {
    const pv = document.getElementById(`pv-${index}`);
    const sac = document.getElementById(`sm-${index}`);
    const valve = document.getElementById(`v-${index}`);
    const mini = document.getElementById(`mini-wd-${index}`);

    if (pv) pv.classList.add('presence-active');
    if (sac) sac.style.display = 'block';
    if (mini) mini.style.display = 'block';
    if (valve) {
        valve.classList.toggle('valve-on', Boolean(valveOn));
    }

    drawBagWeight(index, state.bags[index]?.weight ?? state.liveWeight);
    updateSpoutCardAppearance(index);
}

function markBagReadyForDrop(index) {
    const bag = state.bags[index];
    if (!bag || !bag.occupied) {
        return;
    }

    bag.snapshotWeight = bag.weight > 0 ? bag.weight : state.liveWeight;
    bag.trackingLive = false;
    bag.readyToDrop = true;
    const valve = document.getElementById(`v-${index}`);
    if (valve) valve.classList.remove('valve-on');
    updateSpoutCardAppearance(index);
}

function processProducedCounter(nextCounter) {
    if (state.bagsProducedCounterPrev === null) {
        state.bagsProducedCounterPrev = nextCounter;
        return;
    }

    if (nextCounter > state.bagsProducedCounterPrev) {
        state.pendingDrops += nextCounter - state.bagsProducedCounterPrev;
    } else if (nextCounter < state.bagsProducedCounterPrev) {
        state.pendingDrops = 0;
        if (nextCounter === 0) {
            document.querySelectorAll('.stacked-sac').forEach((node) => node.remove());
            resetBagStates();
            state.sacCount = 0;
        }
    }

    state.bagsProducedCounterPrev = nextCounter;
    flushPendingDrops();
}

function flushPendingDrops() {
    while (state.pendingDrops > 0) {
        const index = state.bags.findIndex((bag) => bag.readyToDrop);
        if (index < 0) {
            break;
        }

        performDrop(index);
        state.pendingDrops -= 1;
    }
}

function drawBagWeight(index, weight) {
    const display = document.getElementById(`wd-${index}`);
    const mini = document.getElementById(`mini-wd-${index}`);
    const cardFill = document.getElementById(`cfill-${index}`);
    const cementFill = document.getElementById(`fill-${index}`);
    const target = clampTargetWeight(state.targetWeight);

    if (display) {
        display.textContent = weight.toFixed(1);
    }
    if (mini) {
        mini.textContent = weight.toFixed(1);
    }

    const pct = Math.min((weight / target) * 100, 100);
    if (cardFill) {
        cardFill.style.height = `${pct}%`;
    }
    if (cementFill) {
        cementFill.style.height = `${pct}%`;
    }

    updateSpoutCardAppearance(index);
}

function performDrop(index) {
    const bag = state.bags[index];
    if (!bag || !bag.readyToDrop) return;

    const finalWeight = bag.snapshotWeight > 0 ? bag.snapshotWeight : bag.weight;

    bag.occupied = false;
    bag.trackingLive = false;
    bag.readyToDrop = false;
    bag.weight = 0;
    bag.snapshotWeight = 0;

    clearSpoutVisual(index);

    state.sacCount += 1;
    dom.txtCount.textContent = String(state.sacCount);

    dom.c10.classList.add('c10-detecting');

    const movingBag = document.createElement('div');
    movingBag.className = 'sac-on-belt';
    movingBag.textContent = `${finalWeight.toFixed(1)}KG`;
    const transportHost = document.getElementById('transport-root') || document.getElementById('stage');
    transportHost.appendChild(movingBag);

    window.setTimeout(() => {
        dom.c10.classList.remove('c10-detecting');
        addToPallet(finalWeight);
        movingBag.remove();
    }, 4000);
}

function clearSpoutVisual(index) {
    const pv = document.getElementById(`pv-${index}`);
    const sac = document.getElementById(`sm-${index}`);
    const display = document.getElementById(`wd-${index}`);
    const mini = document.getElementById(`mini-wd-${index}`);
    const cardFill = document.getElementById(`cfill-${index}`);
    const cementFill = document.getElementById(`fill-${index}`);
    const valve = document.getElementById(`v-${index}`);

    if (pv) pv.classList.remove('presence-active');
    if (sac) sac.style.display = 'none';
    if (mini) {
        mini.textContent = '0.0';
        mini.style.display = 'none';
    }
    if (display) {
        display.textContent = '0.0';
    }
    if (cardFill) cardFill.style.height = '0%';
    if (cementFill) cementFill.style.height = '0%';
    if (valve) valve.classList.remove('valve-on');

    updateSpoutCardAppearance(index);
}

function addToPallet(weight) {
    const stackedBag = document.createElement('div');
    stackedBag.className = 'stacked-sac';
    stackedBag.textContent = `${weight.toFixed(1)}KG`;

    const layer = Math.floor((state.sacCount - 1) / 2);
    const side = (state.sacCount - 1) % 2;

    stackedBag.style.bottom = `${10 + layer * 14}px`;
    stackedBag.style.left = `${44 + side * 28 + layer * 2}%`;
    stackedBag.style.transform = `translateX(${layer * 6}px)`;

    const palletHost = document.querySelector('.pallet-wrap') || document.getElementById('stage');
    palletHost.appendChild(stackedBag);
}

function applyMotionFromState() {
    dom.belt.classList.toggle('belt-move', state.motorBande);
    dom.packer.style.transform = `rotate(${state.angleDeg.toFixed(2)}deg)`;
}

function updateModeButtons() {
    dom.btnModeLocal.classList.toggle('active', state.modeLocal);
    dom.btnModeCentral.classList.toggle('active', state.modeCentral);
}

function updateUI() {
    const noModeSelected = !state.modeLocal && !state.modeCentral;
    const modeText = noModeSelected
        ? (state.connected ? 'A CHOISIR' : '---')
        : (state.modeLocal ? 'LOCAL' : 'CENTRAL');
    const machineRunning = state.motorEnsacheuse || state.motorBande;

    dom.txtMode.textContent = modeText;
    dom.txtState.textContent = machineRunning ? 'EN MARCHE' : 'ARRET';
    dom.txtTarget.textContent = state.targetWeight.toFixed(1);
    dom.txtTargetLive.textContent = state.targetWeight.toFixed(1);
    dom.txtWeight.textContent = state.liveWeight.toFixed(1);
    dom.txtFault.textContent = state.faultGlobal ? 'ACTIF' : 'AUCUN';
    dom.txtCount.textContent = String(state.sacCount);

    dom.vAu.classList.toggle('v-active', state.faults.au);
    dom.vEco.classList.toggle('v-active', state.faults.ecoulement);
    dom.vMot.classList.toggle('v-active', state.faults.moteur);
    dom.vCap.classList.toggle('v-active', state.faults.capteur);
    dom.vDis.classList.toggle('v-active', state.faults.dejoncteur);

    updateModeButtons();

    dom.btnModeLocal.disabled = !state.connected;
    dom.btnModeCentral.disabled = !state.connected;
    dom.btnMarcheCentral.disabled = !state.connected || !state.modeCentral || state.modeLocal;
    dom.btnArretCentral.disabled = !state.connected || !state.modeCentral || state.modeLocal;
    dom.btnMettreSac.disabled = !state.connected;
    dom.btnAcquittement.disabled = !state.connected;
    dom.btnAu.disabled = !state.connected;
    dom.btnApplyTarget.disabled = !state.connected;

    if (!state.socketConnected) {
        dom.systemStatus.textContent = 'PASSERELLE: DECONNECTEE';
        dom.systemStatus.classList.remove('status-ok');
        dom.systemStatus.classList.add('status-fault');
    } else if (!state.connected) {
        dom.systemStatus.textContent = 'PLC: DECONNECTE';
        dom.systemStatus.classList.remove('status-ok');
        dom.systemStatus.classList.add('status-fault');
    } else if (state.faultGlobal) {
        dom.systemStatus.textContent = 'PLC: DEFAUT ACTIF';
        dom.systemStatus.classList.remove('status-ok');
        dom.systemStatus.classList.add('status-fault');
    } else {
        dom.systemStatus.textContent = 'PLC: CONNECTE';
        dom.systemStatus.classList.remove('status-fault');
        dom.systemStatus.classList.add('status-ok');
    }

    updateAllSpoutCards();
}

function animateWorker() {
    dom.worker.classList.add('worker-action');
    window.setTimeout(() => {
        dom.worker.classList.remove('worker-action');
    }, 800);
}

function handlePostError(error, commandLabel) {
    log(`${commandLabel} echoue: ${error.message}`);
}

function log(message) {
    const line = document.createElement('div');
    line.className = 'screen-line screen-line--event';
    line.textContent = message;
    dom.screen.appendChild(line);
    dom.screen.scrollTop = dom.screen.scrollHeight;
}
