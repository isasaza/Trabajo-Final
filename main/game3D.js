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
    limiteX: 8,
    velocidadCamara: 8,
    invulnerabilidad: 1.5,
    limiteObjetos: 20
};

const ESTADOS = {
    INICIO: "inicio",
    JUGANDO: "jugando",
    PAUSA: "pausa",
    GAMEOVER: "gameover",
    VICTORIA: "victoria"
};

// =====================================================
// 02. CONFIGURACION DE LOS TRES TRAMOS
// =====================================================

const TRAMOS = [
    {
        id: 0,
        inicioZ: 0,
        finZ: 23,
        velocidadCarros: 2.5,
        velocidadTroncos: 1.4,
        zonas: [
            { tipo: "suelo", inicio: 0, fin: 3 },
            { tipo: "carretera", inicio: 4, fin: 8 },
            { tipo: "agua", inicio: 9, fin: 13 },
            { tipo: "suelo", inicio: 14, fin: 15 },
            { tipo: "carretera", inicio: 16, fin: 20 },
            { tipo: "checkpoint", inicio: 21, fin: 23 }
        ]
    },
    {
        id: 1,
        inicioZ: 24,
        finZ: 47,
        velocidadCarros: 4.2,
        velocidadTroncos: 2,
        zonas: [
            { tipo: "suelo", inicio: 24, fin: 26 },
            { tipo: "carretera", inicio: 27, fin: 31 },
            { tipo: "agua", inicio: 32, fin: 36 },
            { tipo: "suelo", inicio: 37, fin: 39 },
            { tipo: "carretera", inicio: 40, fin: 44 },
            { tipo: "checkpoint", inicio: 45, fin: 47 }
        ]
    },
    {
        id: 2,
        inicioZ: 48,
        finZ: 73,
        velocidadCarros: 6,
        velocidadTroncos: 2.6,
        zonas: [
            { tipo: "suelo", inicio: 48, fin: 50 },
            { tipo: "carretera", inicio: 51, fin: 55 },
            { tipo: "sierras", inicio: 56, fin: 59 },
            { tipo: "agua", inicio: 60, fin: 64 },
            { tipo: "carretera", inicio: 65, fin: 69 },
            { tipo: "sierras", inicio: 70, fin: 71 },
            { tipo: "trofeo", inicio: 72, fin: 73 }
        ]
    }
];

let estado = ESTADOS.INICIO;
let vidas = CONFIG.vidas;
let tiempo = CONFIG.tiempo;
let puntos = 0;
let gemasRecogidas = 0;
let tramoActual = 0;
let checkpointZ = 0;
let invulnerable = 0;
let velocidadVertical = 0;
let tiempoAnimacion = 0;
let modoCamara = 0;

const teclas = {};
const vehiculos = [];
const troncos = [];
const sierras = [];
const gemas = [];
const particulas = [];

const tramosConstruidos = new Set();
const filasAgua = new Set();

const reloj = new THREE.Clock();

// =====================================================
// 03. ESCENA Y RENDERIZADOR
// =====================================================

const escena = new THREE.Scene();
escena.background = new THREE.Color(0x10213b);
escena.fog = new THREE.Fog(0x10213b, 45, 110);

const camara = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    180
);

camara.position.set(0, 7, -9);

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
// 04. ILUMINACION
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
// 05. MATERIALES Y FUNCIONES
// =====================================================

function material(color, metal = false) {
    return new THREE.MeshStandardMaterial({
        color,
        metalness: metal ? 0.55 : 0.05,
        roughness: metal ? 0.35 : 0.85
    });
}

const MAT = {
    suelo: material(0x287252),
    carretera: material(0x283142),
    agua: material(0x127bb6, true),
    metal: material(0x6d8099, true),
    blanco: material(0xeaf6ff),
    negro: material(0x152238),
    naranja: material(0xffaa35, true),
    azul: material(0x35dfff, true),
    amarillo: material(0xffd75c),
    madera: material(0x98613b),
    rojo: material(0xff526b, true),
    violeta: material(0xa27bff, true),
    verde: material(0x38e8a5, true),
    checkpoint: material(0x187e75),
    sierra: material(0xd0d7e2, true),
    peligro: material(0x8e3850)
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
// 06. TEXTURA CANVAS
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
// 07. PERSONAJE ASTRO
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
escena.add(astro);

// =====================================================
// 08. ROBOT BOLT
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
// 09. CONSTRUCCION PROGRESIVA DEL MAPA
// =====================================================

function construirTramo(tramo) {

    if (tramosConstruidos.has(tramo.id)) {
        return;
    }

    tramosConstruidos.add(tramo.id);

    for (const zona of tramo.zonas) {
        for (let z = zona.inicio; z <= zona.fin; z++) {

            let mat = MAT.suelo;

            if (zona.tipo === "carretera") {
                mat = MAT.carretera;
            }

            if (zona.tipo === "agua") {
                mat = MAT.agua;
                filasAgua.add(z);
            }

            if (zona.tipo === "checkpoint") {
                mat = MAT.checkpoint;
            }

            if (zona.tipo === "sierras") {
                mat = MAT.peligro;
            }

            if (zona.tipo === "trofeo") {
                mat = MAT_META;
            }

            // Suelo central
            escena.add(
                caja(
                    19, 0.2, 1,
                    mat,
                    0, -0.15, z
                )
            );

            // Carreteras y rios extendidos lateralmente
            if (
                zona.tipo === "carretera" ||
                zona.tipo === "agua"
            ) {
                for (const lado of [-1, 1]) {
                    escena.add(
                        caja(
                            15, 0.2, 1,
                            mat,
                            lado * 17,
                            -0.15,
                            z
                        )
                    );
                }
            }

            // Lineas de carretera
            if (zona.tipo === "carretera") {
                for (let x = -21; x <= 21; x += 3) {
                    escena.add(
                        caja(
                            1.4, 0.025, 0.07,
                            MAT.amarillo,
                            x, -0.035, z + 0.48
                        )
                    );
                }
            }

            // Edificios solo en zonas seguras
            if (
                zona.tipo === "suelo" &&
                z % 4 === 0
            ) {
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

        if (zona.tipo === "carretera") {
            crearCarriles(zona, tramo);
        }

        if (zona.tipo === "agua") {
            crearRio(zona, tramo);
        }

        if (zona.tipo === "sierras") {
            crearZonaSierras(zona);
        }
    }

    if (tramo.id < 2) {
        crearGema(
            tramo.id + 1,
            tramo.finZ - 1
        );
    } else {
        crearTrofeo(tramo.finZ - 1);
    }
}

// =====================================================
// 10. VEHICULOS
// =====================================================

function crearVehiculo(z, x, velocidad, color) {
    const grupo = new THREE.Group();
    const mat = material(color, true);

    grupo.add(
        caja(2.2, 0.65, 0.85, mat, 0, 0.55, 0)
    );

    grupo.add(
        caja(1.2, 0.42, 0.7, MAT.negro, 0, 1.05, 0)
    );

    for (const lado of [-1, 1]) {
        grupo.add(
            esfera(
                0.22, MAT.negro,
                lado * 0.75, 0.22, 0.43
            )
        );

        grupo.add(
            esfera(
                0.22, MAT.negro,
                lado * 0.75, 0.22, -0.43
            )
        );
    }

    grupo.position.set(x, 0, z);
    escena.add(grupo);

    vehiculos.push({
        mesh: grupo,
        velocidad
    });
}

function crearCarriles(zona, tramo) {

    let indice = 0;

    for (
        let z = zona.inicio;
        z <= zona.fin;
        z += 2
    ) {
        const direccion =
            indice % 2 === 0 ? 1 : -1;

        const velocidad =
            direccion *
            (
                tramo.velocidadCarros +
                (indice % 3) * 0.4
            );

        for (let j = 0; j < 2; j++) {
            crearVehiculo(
                z,
                -7 + j * 12,
                velocidad,
                [
                    0xff526b,
                    0x42bfff,
                    0xffbd4a,
                    0xa27bff
                ][indice % 4]
            );
        }

        indice++;
    }
}

// =====================================================
// 11. TRONCOS
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
        velocidad
    });
}

function crearRio(zona, tramo) {

    let indice = 0;

    for (
        let z = zona.inicio;
        z <= zona.fin;
        z++
    ) {
        const direccion =
            indice % 2 === 0 ? 1 : -1;

        const velocidad =
            direccion * tramo.velocidadTroncos;

        for (let j = 0; j < 3; j++) {
            crearTronco(
                z,
                -10 + j * 10,
                velocidad
            );
        }

        indice++;
    }
}

// =====================================================
// 12. SIERRAS GIRATORIAS
// =====================================================

function crearZonaSierras(zona) {

    for (
        let z = zona.inicio;
        z <= zona.fin;
        z += 2
    ) {
        const grupo = new THREE.Group();

        const disco = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.7, 0.7, 0.18, 12
            ),
            MAT.sierra
        );

        disco.rotation.x = Math.PI / 2;
        grupo.add(disco);

        // Dientes de la sierra
        for (let i = 0; i < 12; i++) {
            const angulo = i * Math.PI * 2 / 12;

            const diente = caja(
                0.23, 0.23, 0.2,
                MAT.sierra,
                Math.cos(angulo) * 0.75,
                Math.sin(angulo) * 0.75,
                0
            );

            diente.rotation.z = angulo;
            grupo.add(diente);
        }

        grupo.position.set(
            z % 4 === 0 ? -3 : 3,
            0.9,
            z
        );

        escena.add(grupo);

        sierras.push({
            mesh: grupo,
            centroX: grupo.position.x,
            tiempo: z,
            velocidad: 1.5
        });
    }
}

// =====================================================
// 13. GEMAS Y TROFEO
// =====================================================

function crearGema(numero, z) {
    const grupo = new THREE.Group();

    grupo.add(
        caja(2.5, 0.2, 1.8, MAT.metal)
    );

    const cristal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.65),
        MAT.azul
    );

    cristal.position.y = 1.3;
    grupo.add(cristal);

    grupo.position.set(0, 0, z);
    escena.add(grupo);

    gemas.push({
        numero,
        mesh: grupo,
        cristal,
        recogida: false
    });
}

let trofeo = null;

function crearTrofeo(z) {
    const grupo = new THREE.Group();

    grupo.add(
        caja(2.5, 0.2, 2, MAT.metal)
    );

    grupo.add(
        caja(0.35, 1, 0.35, MAT.amarillo, 0, 0.8, 0)
    );

    const copa = new THREE.Mesh(
        new THREE.CylinderGeometry(
            0.8, 0.35, 0.9, 12
        ),
        MAT.amarillo
    );

    copa.position.y = 1.6;
    grupo.add(copa);

    grupo.position.set(0, 0, z);
    escena.add(grupo);

    trofeo = grupo;
}

// =====================================================
// 14. HUD Y ESTADOS
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
    UI.metas.textContent = gemasRecogidas + "/2";
    UI.tiempo.textContent = Math.ceil(tiempo);

    UI.camaraModo.textContent =
        modoCamara === 0 ? "Elevada" : "Primera persona";
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

// =====================================================
// 15. CHECKPOINTS Y PROGRESO
// =====================================================

function reaparecer() {
    astro.position.set(0, 0, checkpointZ);
    astro.rotation.y = 0;
    velocidadVertical = 0;
    invulnerable = CONFIG.invulnerabilidad;
}

function recogerGema(gema) {

    if (gema.recogida) return;

    gema.recogida = true;
    gema.cristal.visible = false;

    gemasRecogidas++;
    puntos += 100;

    checkpointZ = gema.mesh.position.z;

    crearParticulas(
        gema.mesh.position,
        0x35dfff
    );

    reproducirSonido(740, 0.25);

    // Desbloquear el siguiente tramo
    if (gemasRecogidas < TRAMOS.length) {
        tramoActual = gemasRecogidas;
        construirTramo(TRAMOS[tramoActual]);
    }

    actualizarHUD();
}

function reiniciar() {
    vidas = CONFIG.vidas;
    tiempo = CONFIG.tiempo;
    puntos = 0;
    gemasRecogidas = 0;
    tramoActual = 0;
    checkpointZ = 0;

    invulnerable = 0;
    velocidadVertical = 0;

    // Ocultar tramos anteriores y reconstruir el estado
    // inicial mediante recarga limpia del juego.
    if (estado !== ESTADOS.INICIO) {
        window.location.reload();
        return;
    }

    reaparecer();
    cambiarEstado(ESTADOS.JUGANDO);
    actualizarHUD();
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
        ? "ASTRO & BOLT"
        : "MISION FALLIDA";

    UI.mensaje.textContent = mensaje;
    UI.boton.textContent = "REINICIAR MISION";

    reproducirSonido(
        victoria ? 880 : 180,
        0.35
    );
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

    if (vidas <= 0) {
        finalizar(false, "Astro se quedo sin vidas.");
    } else {
        reaparecer();
    }

    actualizarHUD();
}

// =====================================================
// 16. CONTROLES
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
// 17. SONIDOS
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

        ganancia.gain.setValueAtTime(
            0.09,
            ahora
        );

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
// 18. PARTICULAS
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
// 19. MOVIMIENTO DEL JUGADOR
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

    // No permite avanzar hacia tramos bloqueados
    astro.position.z = THREE.MathUtils.clamp(
        astro.position.z,
        0,
        TRAMOS[tramoActual].finZ
    );

    invulnerable = Math.max(
        0,
        invulnerable - dt
    );

    astro.visible =
        modoCamara === 0 &&
        (
            invulnerable <= 0 ||
            Math.floor(invulnerable * 10) % 2 === 0
        );
}

// =====================================================
// 20. MOVIMIENTO DE OBSTACULOS
// =====================================================

function actualizarObjetos(dt) {

    for (const vehiculo of vehiculos) {
        vehiculo.mesh.position.x +=
            vehiculo.velocidad * dt;

        if (
            vehiculo.velocidad > 0 &&
            vehiculo.mesh.position.x > CONFIG.limiteObjetos
        ) {
            vehiculo.mesh.position.x =
                -CONFIG.limiteObjetos;
        }

        if (
            vehiculo.velocidad < 0 &&
            vehiculo.mesh.position.x < -CONFIG.limiteObjetos
        ) {
            vehiculo.mesh.position.x =
                CONFIG.limiteObjetos;
        }
    }

    for (const tronco of troncos) {
        tronco.mesh.position.x +=
            tronco.velocidad * dt;

        if (
            tronco.velocidad > 0 &&
            tronco.mesh.position.x > CONFIG.limiteObjetos
        ) {
            tronco.mesh.position.x =
                -CONFIG.limiteObjetos;
        }

        if (
            tronco.velocidad < 0 &&
            tronco.mesh.position.x < -CONFIG.limiteObjetos
        ) {
            tronco.mesh.position.x =
                CONFIG.limiteObjetos;
        }
    }

    for (const sierra of sierras) {
        sierra.mesh.rotation.z += dt * 8;

        sierra.mesh.position.x =
            sierra.centroX +
            Math.sin(
                tiempoAnimacion * sierra.velocidad +
                sierra.tiempo
            ) * 3;
    }
}

// =====================================================
// 21. COLISIONES Y RECOLECCION
// =====================================================

function comprobarColisiones(dt) {
    const x = astro.position.x;
    const z = astro.position.z;

    // Vehiculos
    if (astro.position.y < 0.65) {
        for (const vehiculo of vehiculos) {
            if (
                Math.abs(
                    x - vehiculo.mesh.position.x
                ) < 1.4 &&
                Math.abs(
                    z - vehiculo.mesh.position.z
                ) < 0.7
            ) {
                perderVida();
                return;
            }
        }
    }

    // Sierras
    if (astro.position.y < 1.5) {
        for (const sierra of sierras) {
            if (
                Math.abs(
                    x - sierra.mesh.position.x
                ) < 0.9 &&
                Math.abs(
                    z - sierra.mesh.position.z
                ) < 0.9
            ) {
                perderVida();
                return;
            }
        }
    }

    // Agua
    const filaActual = Math.round(z);

    if (filasAgua.has(filaActual)) {
        let troncoActual = null;

        for (const tronco of troncos) {
            if (
                Math.abs(
                    x - tronco.mesh.position.x
                ) < 1.65 &&
                Math.abs(
                    z - tronco.mesh.position.z
                ) < 0.55
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

    // Gemas
    for (const gema of gemas) {
        if (gema.recogida) continue;

        const distancia = Math.hypot(
            x - gema.mesh.position.x,
            z - gema.mesh.position.z
        );

        if (distancia < 1.1) {
            recogerGema(gema);
            return;
        }
    }

    // Trofeo
    if (trofeo) {
        const distancia = Math.hypot(
            x - trofeo.position.x,
            z - trofeo.position.z
        );

        if (distancia < 1.2) {
            puntos += 300;

            finalizar(
                true,
                "Recogiste las dos gemas y alcanzaste el trofeo final."
            );
        }
    }
}

// =====================================================
// 22. CAMARA ELEVADA Y PRIMERA PERSONA
// =====================================================

const posicionCamara = new THREE.Vector3();
const objetivoCamara = new THREE.Vector3();
const miradaCamara = new THREE.Vector3(0, 1, 5);

let fovActual = 70;

function actualizarCamara(dt) {

    if (modoCamara === 0) {
        posicionCamara.set(
            astro.position.x,
            astro.position.y + 7,
            astro.position.z - 9
        );

        objetivoCamara.set(
            astro.position.x,
            astro.position.y + 1,
            astro.position.z + 8
        );
    } else {
        posicionCamara.set(
            astro.position.x,
            astro.position.y + 1.7,
            astro.position.z + 0.15
        );

        objetivoCamara.set(
            astro.position.x,
            astro.position.y + 1.7,
            astro.position.z + 12
        );
    }

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

    const fovObjetivo =
        modoCamara === 0 ? 70 : 80;

    const nuevoFov = THREE.MathUtils.lerp(
        fovActual,
        fovObjetivo,
        suavidad
    );

    if (Math.abs(nuevoFov - fovActual) > 0.001) {
        fovActual = nuevoFov;
        camara.fov = fovActual;
        camara.updateProjectionMatrix();
    }
}

// =====================================================
// 23. ANIMACIONES
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
    bolt.visible = modoCamara === 0;

    for (const gema of gemas) {
        if (!gema.recogida) {
            gema.cristal.rotation.y += dt * 1.6;

            gema.cristal.position.y =
                1.3 +
                Math.sin(tiempoAnimacion * 2) * 0.15;
        }
    }

    if (trofeo) {
        trofeo.rotation.y += dt * 0.3;
    }
}

// =====================================================
// 24. BUCLE PRINCIPAL
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

// Construir solamente el primer tramo al iniciar
construirTramo(TRAMOS[0]);

actualizarHUD();
animar();

// =====================================================
// 25. AJUSTE DE PANTALLA
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