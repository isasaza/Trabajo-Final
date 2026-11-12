import * as THREE from "three";

// =====================================================
// 01. CONFIGURACION GENERAL
// =====================================================

const CONFIG = {
    vidas: 3,
    tiempo: 240,
    velocidadJugador: 6,
    fuerzaSalto: 7,
    gravedad: 18,
    anchoMapa: 19,
    largoMapa: 80,
    limiteX: 8,
    metaZ: 77,
    velocidadCamara: 7,
    invulnerabilidad: 1.5
};

const ESTADOS = {
    INICIO: "inicio",
    JUGANDO: "jugando",
    PAUSA: "pausa",
    GAMEOVER: "gameover",
    VICTORIA: "victoria"
};

let estado = ESTADOS.INICIO;
let vidas = CONFIG.vidas;
let tiempo = CONFIG.tiempo;
let puntos = 0;
let metas = 0;

let invulnerable = 0;
let velocidadVertical = 0;
let tiempoAnimacion = 0;
let modoCamara = 0;

const teclas = {};
const vehiculos = [];
const troncos = [];
const objetivos = [];
const particulas = [];

const reloj = new THREE.Clock();

// =====================================================
// 02. ESCENA, CAMARA Y RENDERIZADOR
// =====================================================

const escena = new THREE.Scene();

escena.background = new THREE.Color(0x10213b);
escena.fog = new THREE.Fog(0x10213b, 55, 130);

const camara = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    180
);

camara.position.set(0, 6, -8);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document
    .getElementById("game-container")
    .appendChild(renderer.domElement);

// =====================================================
// 03. ILUMINACION
// =====================================================

escena.add(
    new THREE.HemisphereLight(
        0xb7e2ff,
        0x263c4a,
        2
    )
);

const sol = new THREE.DirectionalLight(
    0xffffff,
    2.4
);

sol.position.set(-12, 25, 15);
sol.castShadow = true;

sol.shadow.mapSize.set(2048, 2048);
sol.shadow.camera.left = -35;
sol.shadow.camera.right = 35;
sol.shadow.camera.top = 90;
sol.shadow.camera.bottom = -35;

escena.add(sol);

// =====================================================
// 04. MATERIALES Y GEOMETRIAS
// =====================================================

function crearMaterial(color, metal = false) {
    return new THREE.MeshStandardMaterial({
        color,
        metalness: metal ? 0.55 : 0.05,
        roughness: metal ? 0.35 : 0.85
    });
}

const MAT = {
    suelo: crearMaterial(0x287252),
    carretera: crearMaterial(0x283142),
    agua: crearMaterial(0x127bb6, true),
    metal: crearMaterial(0x6d8099, true),
    blanco: crearMaterial(0xeaf6ff),
    negro: crearMaterial(0x152238),
    naranja: crearMaterial(0xffaa35, true),
    azul: crearMaterial(0x35dfff, true),
    amarillo: crearMaterial(0xffd75c),
    madera: crearMaterial(0x98613b),
    rojo: crearMaterial(0xff526b, true),
    violeta: crearMaterial(0xa27bff, true),
    verde: crearMaterial(0x38e8a5, true)
};

function caja(w, h, d, mat, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        mat
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
}

function esfera(r, mat, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 12),
        mat
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;

    return mesh;
}

// =====================================================
// 05. TEXTURA ORIGINAL CON CANVAS
// =====================================================

const lienzo = document.createElement("canvas");
lienzo.width = 128;
lienzo.height = 128;

const ctx = lienzo.getContext("2d");

ctx.fillStyle = "#34455d";
ctx.fillRect(0, 0, 128, 128);

ctx.strokeStyle = "#60758e";
ctx.lineWidth = 3;

for (let i = 0; i <= 128; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
}

const textura = new THREE.CanvasTexture(lienzo);

const MAT_META = new THREE.MeshStandardMaterial({
    map: textura,
    roughness: 0.8
});

// =====================================================
// 06. TILEMAP
//
// S = Suelo seguro
// C = Carretera
// A = Agua
// M = Meta
// B = Borde
// =====================================================

const zonasCarretera = [
    [5, 12],
    [17, 24],
    [29, 36]
];

const zonasAgua = [
    [42, 49],
    [54, 61],
    [66, 72]
];

const filasCarretera = [];
const filasAgua = [];

for (const [inicio, fin] of zonasCarretera) {
    for (let z = inicio; z <= fin; z++) {
        filasCarretera.push(z);
    }
}

for (const [inicio, fin] of zonasAgua) {
    for (let z = inicio; z <= fin; z++) {
        filasAgua.push(z);
    }
}

const mapa = [];

for (let z = 0; z < CONFIG.largoMapa; z++) {
    let tipo = "S";

    if (filasCarretera.includes(z)) {
        tipo = "C";
    }

    if (filasAgua.includes(z)) {
        tipo = "A";
    }

    if (z === CONFIG.metaZ) {
        tipo = "M";
    }

    mapa.push(
        "B" +
        tipo.repeat(CONFIG.anchoMapa - 2) +
        "B"
    );
}

// =====================================================
// 07. CONSTRUCCION DEL ESCENARIO
// =====================================================

function construirNivel() {
    for (let z = 0; z < mapa.length; z++) {
        for (let c = 0; c < mapa[z].length; c++) {
            const tipo = mapa[z][c];
            const x = c - 9;

            if (tipo === "B") {
                escena.add(
                    caja(1, 0.7, 1, MAT.metal, x, 0.25, z)
                );
                continue;
            }

            let mat = MAT.suelo;

            if (tipo === "C") mat = MAT.carretera;
            if (tipo === "A") mat = MAT.agua;
            if (tipo === "M") mat = MAT_META;

            escena.add(
                caja(1, 0.2, 1, mat, x, -0.15, z)
            );
        }
    }

    // Lineas de separacion de carriles
    for (const z of filasCarretera) {
        for (let x = -7; x <= 7; x += 3) {
            escena.add(
                caja(
                    1.4, 0.025, 0.07,
                    MAT.amarillo,
                    x, -0.035, z + 0.48
                )
            );
        }
    }

    // Edificios laterales
    for (let z = 0; z < CONFIG.largoMapa; z += 5) {
        for (const lado of [-1, 1]) {
            const altura = 3 + (z % 6);

            escena.add(
                caja(
                    3, altura, 3,
                    MAT.metal,
                    lado * 13,
                    altura / 2,
                    z
                )
            );
        }
    }
}

construirNivel();

// =====================================================
// 08. PERSONAJE ASTRO
// =====================================================

const astro = new THREE.Group();

astro.add(
    caja(0.65, 0.85, 0.42, MAT.naranja, 0, 1.05, 0)
);

astro.add(
    esfera(0.46, MAT.blanco, 0, 1.75, 0)
);

astro.add(
    caja(0.66, 0.25, 0.13, MAT.azul, 0, 1.78, 0.41)
);

const brazoI = caja(
    0.2, 0.65, 0.25,
    MAT.metal, -0.48, 1.08, 0
);

const brazoD = caja(
    0.2, 0.65, 0.25,
    MAT.metal, 0.48, 1.08, 0
);

const piernaI = caja(
    0.23, 0.65, 0.3,
    MAT.negro, -0.2, 0.35, 0
);

const piernaD = caja(
    0.23, 0.65, 0.3,
    MAT.negro, 0.2, 0.35, 0
);

astro.add(brazoI, brazoD, piernaI, piernaD);
astro.position.set(0, 0, 0);

escena.add(astro);

// =====================================================
// 09. ROBOT BOLT
// =====================================================

const bolt = new THREE.Group();

bolt.add(esfera(0.33, MAT.blanco));
bolt.add(esfera(0.17, MAT.azul, 0, 0, 0.3));

bolt.add(
    caja(0.8, 0.07, 0.16, MAT.metal, 0, -0.08, 0)
);

bolt.position.set(1, 1.8, -0.6);
escena.add(bolt);

// =====================================================
// 10. VEHICULOS SOBRE LAS CARRETERAS
// =====================================================

function crearVehiculo(z, x, velocidad, color) {
    const grupo = new THREE.Group();
    const mat = crearMaterial(color, true);

    grupo.add(
        caja(2.2, 0.65, 0.85, mat, 0, 0.55, 0)
    );

    grupo.add(
        caja(1.2, 0.42, 0.7, MAT.negro, 0, 1.05, 0)
    );

    for (const lado of [-1, 1]) {
        grupo.add(
            esfera(
                0.22, MAT.azul,
                lado * 0.75, 0.22, 0.43
            )
        );

        grupo.add(
            esfera(
                0.22, MAT.azul,
                lado * 0.75, 0.22, -0.43
            )
        );
    }

    grupo.position.set(x, 0, z);
    escena.add(grupo);

    vehiculos.push({
        mesh: grupo,
        velocidad,
        ancho: 2.2
    });
}

// Cada vehiculo se coloca en una fila de carretera
filasCarretera.forEach((z, i) => {
    const direccion = i % 2 === 0 ? 1 : -1;
    const velocidad = direccion * (2.5 + (i % 4) * 0.7);

    for (let j = 0; j < 3; j++) {
        crearVehiculo(
            z,
            -8 + j * 7,
            velocidad,
            [
                0xff526b,
                0x42bfff,
                0xffbd4a,
                0xa27bff
            ][i % 4]
        );
    }
});

// =====================================================
// 11. TRONCOS SOBRE EL RIO
// =====================================================

function crearTronco(z, x, velocidad) {
    const grupo = new THREE.Group();

    grupo.add(
        caja(3.6, 0.5, 0.85, MAT.madera, 0, 0.2, 0)
    );

    for (const extremo of [-1, 1]) {
        grupo.add(
            caja(
                0.1, 0.54, 0.9,
                MAT.amarillo,
                extremo * 1.7,
                0.2,
                0
            )
        );
    }

    grupo.position.set(x, 0, z);
    escena.add(grupo);

    troncos.push({
        mesh: grupo,
        velocidad,
        ancho: 3.6
    });
}

filasAgua.forEach((z, i) => {
    const direccion = i % 2 === 0 ? 1 : -1;
    const velocidad = direccion * (1.4 + (i % 4) * 0.25);

    for (let j = 0; j < 3; j++) {
        crearTronco(
            z,
            -8 + j * 7,
            velocidad
        );
    }
});

// =====================================================
// 12. TRES METAS
// =====================================================

for (let i = 0; i < 3; i++) {
    const x = [-6, 0, 6][i];
    const grupo = new THREE.Group();

    grupo.add(
        caja(2.5, 0.15, 1.5, MAT.metal)
    );

    const cristal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.65),
        MAT.azul
    );

    cristal.position.y = 1.2;
    grupo.add(cristal);

    grupo.position.set(x, 0, CONFIG.metaZ);
    escena.add(grupo);

    objetivos.push({
        mesh: grupo,
        cristal,
        activada: false
    });
}

// =====================================================
// 13. INTERFAZ Y ESTADOS
// =====================================================

const UI = {
    vidas: document.getElementById("vidas"),
    puntos: document.getElementById("puntos"),
    metas: document.getElementById("metas"),
    tiempo: document.getElementById("tiempo"),
    camaraModo: document.getElementById("camaraModo"),
    overlay: document.getElementById("overlay"),
    pausa: document.getElementById("pausa"),
    titulo: document.getElementById("titulo"),
    subtitulo: document.getElementById("subtitulo"),
    mensaje: document.getElementById("mensaje"),
    boton: document.getElementById("btnJugar")
};

function actualizarHUD() {
    UI.vidas.textContent = vidas;
    UI.puntos.textContent = puntos;
    UI.metas.textContent = metas + "/3";
    UI.tiempo.textContent = Math.ceil(tiempo);
    UI.camaraModo.textContent =
        modoCamara === 0 ? "Elevada" : "Personaje";
}

function cambiarEstado(nuevoEstado) {
    estado = nuevoEstado;

    const mostrarOverlay = [
        ESTADOS.INICIO,
        ESTADOS.GAMEOVER,
        ESTADOS.VICTORIA
    ].includes(estado);

    UI.overlay.classList.toggle(
        "hidden",
        !mostrarOverlay
    );

    UI.pausa.classList.toggle(
        "hidden",
        estado !== ESTADOS.PAUSA
    );
}

function reaparecer() {
    astro.position.set(0, 0, 0);
    astro.rotation.y = 0;
    velocidadVertical = 0;
    invulnerable = CONFIG.invulnerabilidad;
}

function reiniciar() {
    vidas = CONFIG.vidas;
    tiempo = CONFIG.tiempo;
    puntos = 0;
    metas = 0;

    invulnerable = 0;
    velocidadVertical = 0;

    objetivos.forEach(objetivo => {
        objetivo.activada = false;
        objetivo.cristal.visible = true;
    });

    reaparecer();
    actualizarHUD();
    cambiarEstado(ESTADOS.JUGANDO);
    reloj.getDelta();
}

function finalizar(victoria, mensaje) {
    cambiarEstado(
        victoria ? ESTADOS.VICTORIA : ESTADOS.GAMEOVER
    );

    UI.titulo.textContent = victoria
        ? "MISION COMPLETADA"
        : "GAME OVER";

    UI.subtitulo.textContent = victoria
        ? "VORTHEX RESCATADO"
        : "MISION FALLIDA";

    UI.mensaje.textContent = mensaje;
    UI.boton.textContent = "REINICIAR MISION";

    reproducirSonido(victoria ? 880 : 180, 0.35);
}

function perderVida() {
    if (
        invulnerable > 0 ||
        estado !== ESTADOS.JUGANDO
    ) {
        return;
    }

    vidas--;

    reproducirSonido(150, 0.2);
    crearParticulas(astro.position, 0xff5252);
    actualizarHUD();

    if (vidas <= 0) {
        finalizar(false, "Astro se quedo sin vidas.");
    } else {
        reaparecer();
    }
}

// =====================================================
// 14. CONTROLES
// =====================================================

window.addEventListener("keydown", evento => {
    const tecla = evento.key.toLowerCase();

    if (
        [
            "arrowup",
            "arrowdown",
            "arrowleft",
            "arrowright",
            " ",
            "tab"
        ].includes(tecla)
    ) {
        evento.preventDefault();
    }

    if (tecla === "tab") {
        if (!evento.repeat) {
            modoCamara = (modoCamara + 1) % 2;
            actualizarHUD();
        }
        return;
    }

    teclas[tecla] = true;

    if (
        (tecla === "p" || tecla === "escape") &&
        !evento.repeat
    ) {
        if (estado === ESTADOS.JUGANDO) {
            cambiarEstado(ESTADOS.PAUSA);
        } else if (estado === ESTADOS.PAUSA) {
            cambiarEstado(ESTADOS.JUGANDO);
            reloj.getDelta();
        }
    }

    if (
        tecla === " " &&
        !evento.repeat &&
        estado === ESTADOS.JUGANDO &&
        astro.position.y <= 0.01
    ) {
        velocidadVertical = CONFIG.fuerzaSalto;
        reproducirSonido(440, 0.08);
    }
});

window.addEventListener("keyup", evento => {
    teclas[evento.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
    Object.keys(teclas).forEach(tecla => {
        teclas[tecla] = false;
    });

    if (estado === ESTADOS.JUGANDO) {
        cambiarEstado(ESTADOS.PAUSA);
    }
});

UI.boton.addEventListener("click", reiniciar);

document
    .getElementById("btnContinuar")
    .addEventListener("click", () => {
        cambiarEstado(ESTADOS.JUGANDO);
        reloj.getDelta();
    });

// =====================================================
// 15. SONIDOS
// =====================================================

let audioContexto = null;

function reproducirSonido(frecuencia, duracion) {
    try {
        if (!audioContexto) {
            audioContexto = new (
                window.AudioContext ||
                window.webkitAudioContext
            )();
        }

        if (audioContexto.state === "suspended") {
            audioContexto.resume();
        }

        const oscilador = audioContexto.createOscillator();
        const ganancia = audioContexto.createGain();

        const ahora = audioContexto.currentTime;

        oscilador.type = "triangle";

        oscilador.frequency.setValueAtTime(
            frecuencia,
            ahora
        );

        ganancia.gain.setValueAtTime(0.09, ahora);

        ganancia.gain.exponentialRampToValueAtTime(
            0.001,
            ahora + duracion
        );

        oscilador.connect(ganancia);
        ganancia.connect(audioContexto.destination);

        oscilador.start(ahora);
        oscilador.stop(ahora + duracion);

    } catch (error) {
        console.warn("Audio no disponible:", error);
    }
}

// =====================================================
// 16. PARTICULAS
// =====================================================

function crearParticulas(posicion, color) {
    for (let i = 0; i < 12; i++) {
        const particula = esfera(
            0.09,
            new THREE.MeshBasicMaterial({ color }),
            posicion.x,
            posicion.y + 1,
            posicion.z
        );

        escena.add(particula);

        particulas.push({
            mesh: particula,
            vida: 0.6,
            velocidad: new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 4,
                (Math.random() - 0.5) * 5
            )
        });
    }
}

function actualizarParticulas(dt) {
    for (let i = particulas.length - 1; i >= 0; i--) {
        const particula = particulas[i];

        particula.vida -= dt;

        particula.mesh.position.addScaledVector(
            particula.velocidad,
            dt
        );

        particula.velocidad.y -= 9 * dt;

        if (particula.vida <= 0) {
            escena.remove(particula.mesh);
            particula.mesh.geometry.dispose();
            particula.mesh.material.dispose();
            particulas.splice(i, 1);
        }
    }
}

// =====================================================
// 17. MOVIMIENTO DEL JUGADOR
// =====================================================

function actualizarJugador(dt) {
    let dx = 0;
    let dz = 0;

    if (teclas["w"] || teclas["arrowup"]) dz++;
    if (teclas["s"] || teclas["arrowdown"]) dz--;
    if (teclas["a"] || teclas["arrowleft"]) dx--;
    if (teclas["d"] || teclas["arrowright"]) dx++;

    const longitud = Math.hypot(dx, dz);

    if (longitud > 0) {
        dx /= longitud;
        dz /= longitud;

        astro.position.x +=
            dx * CONFIG.velocidadJugador * dt;

        astro.position.z +=
            dz * CONFIG.velocidadJugador * dt;

        astro.rotation.y = Math.atan2(dx, dz);

        const paso = Math.sin(tiempoAnimacion * 12) * 0.4;

        piernaI.rotation.x = paso;
        piernaD.rotation.x = -paso;
        brazoI.rotation.x = -paso;
        brazoD.rotation.x = paso;
    } else {
        piernaI.rotation.x = 0;
        piernaD.rotation.x = 0;
        brazoI.rotation.x = 0;
        brazoD.rotation.x = 0;
    }

    if (
        astro.position.y > 0 ||
        velocidadVertical > 0
    ) {
        velocidadVertical -= CONFIG.gravedad * dt;
        astro.position.y += velocidadVertical * dt;

        if (astro.position.y < 0) {
            astro.position.y = 0;
            velocidadVertical = 0;
        }
    }

    astro.position.x = THREE.MathUtils.clamp(
        astro.position.x,
        -CONFIG.limiteX,
        CONFIG.limiteX
    );

    astro.position.z = THREE.MathUtils.clamp(
        astro.position.z,
        0,
        CONFIG.metaZ + 0.5
    );

    invulnerable = Math.max(
        0,
        invulnerable - dt
    );

    astro.visible =
        invulnerable <= 0 ||
        Math.floor(invulnerable * 10) % 2 === 0;
}

// =====================================================
// 18. MOVIMIENTO Y RECICLAJE DE OBJETOS
// =====================================================

function actualizarObjetos(dt) {
    for (const vehiculo of vehiculos) {
        vehiculo.mesh.position.x +=
            vehiculo.velocidad * dt;

        if (
            vehiculo.velocidad > 0 &&
            vehiculo.mesh.position.x > 13
        ) {
            vehiculo.mesh.position.x = -13;
        }

        if (
            vehiculo.velocidad < 0 &&
            vehiculo.mesh.position.x < -13
        ) {
            vehiculo.mesh.position.x = 13;
        }
    }

    for (const tronco of troncos) {
        tronco.mesh.position.x +=
            tronco.velocidad * dt;

        if (
            tronco.velocidad > 0 &&
            tronco.mesh.position.x > 13
        ) {
            tronco.mesh.position.x = -13;
        }

        if (
            tronco.velocidad < 0 &&
            tronco.mesh.position.x < -13
        ) {
            tronco.mesh.position.x = 13;
        }
    }
}

// =====================================================
// 19. COLISIONES
// =====================================================

function comprobarColisiones(dt) {
    const x = astro.position.x;
    const z = astro.position.z;

    // Colision con vehiculos
    if (astro.position.y < 0.65) {
        for (const vehiculo of vehiculos) {
            const diferenciaX = Math.abs(
                x - vehiculo.mesh.position.x
            );

            const diferenciaZ = Math.abs(
                z - vehiculo.mesh.position.z
            );

            if (
                diferenciaX < 1.4 &&
                diferenciaZ < 0.7
            ) {
                perderVida();
                return;
            }
        }
    }

    // Rio y troncos
    const filaActual = Math.round(z);

    if (filasAgua.includes(filaActual)) {
        let troncoActual = null;

        for (const tronco of troncos) {
            const diferenciaX = Math.abs(
                x - tronco.mesh.position.x
            );

            const diferenciaZ = Math.abs(
                z - tronco.mesh.position.z
            );

            if (
                diferenciaX < 1.65 &&
                diferenciaZ < 0.55
            ) {
                troncoActual = tronco;
                break;
            }
        }

        if (
            troncoActual &&
            astro.position.y < 0.5
        ) {
            astro.position.x +=
                troncoActual.velocidad * dt;
        }

        if (
            !troncoActual &&
            astro.position.y < 0.15
        ) {
            perderVida();
            return;
        }
    }

    // Metas
    if (z > CONFIG.metaZ - 0.7) {
        for (const objetivo of objetivos) {
            if (objetivo.activada) continue;

            const distanciaX = Math.abs(
                astro.position.x -
                objetivo.mesh.position.x
            );

            if (distanciaX < 1.2) {
                objetivo.activada = true;
                objetivo.cristal.visible = false;

                metas++;
                puntos += 100;

                reproducirSonido(740, 0.25);

                crearParticulas(
                    objetivo.mesh.position,
                    0x36ffb1
                );

                actualizarHUD();

                if (metas === 3) {
                    finalizar(
                        true,
                        "Astro y Bolt activaron las tres estaciones."
                    );
                } else {
                    reaparecer();
                }

                return;
            }
        }
    }
}

// =====================================================
// 20. CAMARA CON DOS MODOS
// =====================================================

const posicionCamara = new THREE.Vector3();
const objetivoCamara = new THREE.Vector3();
const miradaCamara = new THREE.Vector3(0, 1, 5);

function actualizarCamara(dt) {
    if (modoCamara === 0) {
        // Vista elevada en tercera persona
        posicionCamara.set(
            astro.position.x,
            astro.position.y + 6,
            astro.position.z - 8
        );

        objetivoCamara.set(
            astro.position.x,
            astro.position.y + 1,
            astro.position.z + 8
        );

        camara.fov = 70;
    } else {
        // Vista cercana al personaje
        posicionCamara.set(
            astro.position.x,
            astro.position.y + 2.2,
            astro.position.z - 1.8
        );

        objetivoCamara.set(
            astro.position.x,
            astro.position.y + 1.7,
            astro.position.z + 12
        );

        camara.fov = 85;
    }

    camara.updateProjectionMatrix();

    const suavidad =
        1 - Math.exp(-CONFIG.velocidadCamara * dt);

    camara.position.lerp(
        posicionCamara,
        suavidad
    );

    miradaCamara.lerp(
        objetivoCamara,
        suavidad
    );

    camara.lookAt(miradaCamara);
}

// =====================================================
// 21. ANIMACIONES
// =====================================================

function actualizarDecoracion(dt) {
    const destinoBolt = new THREE.Vector3(
        astro.position.x + 1,
        astro.position.y + 1.8 +
            Math.sin(tiempoAnimacion * 3) * 0.15,
        astro.position.z - 0.6
    );

    bolt.position.lerp(
        destinoBolt,
        1 - Math.exp(-5 * dt)
    );

    bolt.rotation.y += dt;

    objetivos.forEach(objetivo => {
        if (!objetivo.activada) {
            objetivo.cristal.rotation.y += dt * 1.6;

            objetivo.cristal.position.y =
                1.2 +
                Math.sin(tiempoAnimacion * 2) * 0.15;
        }
    });
}

// =====================================================
// 22. BUCLE PRINCIPAL
// =====================================================

function animar() {
    requestAnimationFrame(animar);

    const dt = Math.min(
        reloj.getDelta(),
        0.05
    );

    if (estado === ESTADOS.JUGANDO) {
        tiempoAnimacion += dt;
        tiempo -= dt;

        if (tiempo <= 0) {
            tiempo = 0;

            finalizar(
                false,
                "Se termino el tiempo disponible."
            );
        } else {
            actualizarJugador(dt);
            actualizarObjetos(dt);
            comprobarColisiones(dt);
            actualizarParticulas(dt);
            actualizarDecoracion(dt);
        }

        actualizarHUD();
    }

    actualizarCamara(dt);
    renderer.render(escena, camara);
}

actualizarHUD();
animar();

// =====================================================
// 23. AJUSTE DE PANTALLA
// =====================================================

window.addEventListener("resize", () => {
    camara.aspect =
        window.innerWidth / window.innerHeight;

    camara.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});