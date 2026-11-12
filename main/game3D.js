import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";

// ============================================================
// 1. CONFIGURACION
// ============================================================

const CONFIG = {
    vidas: 3,
    tiempo: 240,
    velocidadJugador: 6,
    salto: 7,
    gravedad: 18,
    limiteX: 8,
    anchoMapa: 20,
    anchoCarretera: 52,
    limiteVehiculos: 29,
    invulnerabilidad: 1.5,
    camaraSuavidad: 7
};

const ETAPAS = [
    {
        inicio: 0,
        final: 29,
        gema: 27,
        zonas: [
            { tipo: "carretera", inicio: 5, final: 10, velocidad: 3.5 },
            { tipo: "agua", inicio: 12, final: 17, velocidad: 1.6 },
            { tipo: "carretera", inicio: 19, final: 24, velocidad: 4.2 }
        ]
    },
    {
        inicio: 29,
        final: 59,
        gema: 57,
        zonas: [
            { tipo: "carretera", inicio: 32, final: 38, velocidad: 5.5 },
            { tipo: "agua", inicio: 40, final: 46, velocidad: 2.2 },
            { tipo: "carretera", inicio: 48, final: 54, velocidad: 6.2 }
        ]
    },
    {
        inicio: 59,
        final: 91,
        gema: null,
        zonas: [
            { tipo: "carretera", inicio: 62, final: 69, velocidad: 7.5 },
            { tipo: "sierras", inicio: 72, final: 83, velocidad: 3.4 }
        ]
    }
];

let estado = "inicio";
let vidas = CONFIG.vidas;
let puntos = 0;
let gemas = 0;
let tiempo = CONFIG.tiempo;
let etapaActual = 0;
let modoCamara = 0;
let invulnerable = 0;
let velocidadY = 0;
let enSuelo = true;
let tiempoGlobal = 0;
let ultimoTiempo = 0;

const teclas = {};
const modelos = {};
const vehiculos = [];
const troncos = [];
const sierras = [];
const gemasObjetos = [];
const naves = [];
const aguaZonas = [];
const gruposEtapa = [];
const checkpoint = new THREE.Vector3(0, 0, 0);

let trofeo = null;

// ============================================================
// 2. HTML
// ============================================================

const obtener = id => document.getElementById(id);

const contenedor = obtener("game-container") || document.body;
const overlay = obtener("overlay");
const pausaPanel = obtener("pausa");

function actualizarHUD() {
    const valores = {
        vidas,
        puntos,
        metas: `${gemas}/2`,
        tiempo: `${Math.ceil(tiempo)}s`,
        camaraModo: modoCamara === 0 ? "Elevada" : "Primera persona"
    };

    for (const [id, valor] of Object.entries(valores)) {
        const elemento = obtener(id);
        if (elemento) elemento.textContent = valor;
    }
}

function mostrarMenu(titulo, subtitulo, mensaje, boton) {
    if (obtener("titulo")) obtener("titulo").textContent = titulo;
    if (obtener("subtitulo")) obtener("subtitulo").textContent = subtitulo;
    if (obtener("mensaje")) obtener("mensaje").textContent = mensaje;
    if (obtener("btnJugar")) obtener("btnJugar").textContent = boton;
    if (overlay) overlay.style.display = "flex";
}

// ============================================================
// 3. ESCENA, CAMARA Y RENDERIZADO
// ============================================================

const escena = new THREE.Scene();
escena.background = new THREE.Color(0x09091e);
escena.fog = new THREE.FogExp2(0x14102c, 0.004);

const camara = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    500
);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;

contenedor.appendChild(renderer.domElement);

const ambiente = new THREE.HemisphereLight(0xadb9ff, 0x141025, 2.2);
escena.add(ambiente);

const sol = new THREE.DirectionalLight(0xc5d7ff, 2.4);
sol.position.set(-15, 35, 20);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
sol.shadow.camera.left = -35;
sol.shadow.camera.right = 35;
sol.shadow.camera.top = 55;
sol.shadow.camera.bottom = -55;
escena.add(sol);

// ============================================================
// 4. MATERIALES
// ============================================================

function material(color, metal = 0, rugosidad = 0.8) {
    return new THREE.MeshStandardMaterial({
        color,
        metalness: metal,
        roughness: rugosidad
    });
}

function neon(color, intensidad = 1.7) {
    return new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: intensidad
    });
}

const MAT = {
    suelo: material(0x24314a),
    acera: material(0x38465b),
    carretera: material(0x101623, 0.2),
    linea: neon(0x85dfff, 0.65),
    amarillo: neon(0xf7dc8c, 0.45),
    agua: new THREE.MeshStandardMaterial({
        color: 0x08649a,
        emissive: 0x003454,
        emissiveIntensity: 0.35,
        metalness: 0.4,
        roughness: 0.24
    }),
    bordeAgua: neon(0x00d7ff),
    madera: material(0x8a583a),
    maderaOscura: material(0x523825),
    metal: material(0x64748b, 0.75, 0.3),
    rosa: neon(0xff49c7),
    azul: neon(0x00cfff),
    oro: neon(0xffcc55)
};

function caja(ancho, alto, fondo, mat, x, y, z, padre = escena) {
    const m = new THREE.Mesh(
        new THREE.BoxGeometry(ancho, alto, fondo),
        mat
    );

    m.position.set(x, y, z);
    m.receiveShadow = true;
    m.castShadow = alto > 0.2;
    padre.add(m);

    return m;
}

function esfera(r, mat, x, y, z, padre = escena) {
    const m = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 12),
        mat
    );

    m.position.set(x, y, z);
    m.castShadow = true;
    padre.add(m);
    return m;
}

// ============================================================
// 5. MODELOS DESCARGADOS
// ============================================================

const loader = new GLTFLoader();

const rutas = {
    carretera: "./modelos/road_tile.glb",
    farola: "./modelos/street_lamp.glb",
    senal: "./modelos/sign_tall.glb",
    comida: "./modelos/noodle_cart.glb",
    maquina: "./modelos/vending_machine.glb"
};

async function cargarModelos() {
    await Promise.all(
        Object.entries(rutas).map(async ([nombre, ruta]) => {
            try {
                const gltf = await loader.loadAsync(ruta);
                modelos[nombre] = gltf.scene;
                console.log("Modelo listo:", nombre);
            } catch (error) {
                modelos[nombre] = null;
                console.warn("No se encontro:", ruta);
            }
        })
    );
}

function colocarModelo(nombre, padre, x, z, ancho, altoMaximo = 8) {
    if (!modelos[nombre]) return null;

    const grupo = new THREE.Group();
    const copia = modelos[nombre].clone(true);

    grupo.add(copia);
    padre.add(grupo);

    copia.updateMatrixWorld(true);

    const limites = new THREE.Box3().setFromObject(copia);
    const tam = limites.getSize(new THREE.Vector3());

    if (Math.max(tam.x, tam.y, tam.z) < 0.0001) {
        padre.remove(grupo);
        return null;
    }

    const escala = Math.min(
        ancho / Math.max(tam.x, tam.z, 0.001),
        altoMaximo / Math.max(tam.y, 0.001)
    );

    copia.scale.setScalar(escala);
    copia.updateMatrixWorld(true);

    const final = new THREE.Box3().setFromObject(copia);
    const centro = final.getCenter(new THREE.Vector3());

    copia.position.x -= centro.x;
    copia.position.z -= centro.z;
    copia.position.y -= final.min.y;

    grupo.position.set(x, 0.15, z);

    return grupo;
}

// ============================================================
// 6. GALAXIA
// ============================================================

function crearGalaxia() {
    const posiciones = [];

    for (let i = 0; i < 1800; i++) {
        const angulo = Math.random() * Math.PI * 2;
        const radio = 95 + Math.random() * 190;

        posiciones.push(
            Math.cos(angulo) * radio,
            25 + Math.random() * 150,
            Math.sin(angulo) * radio + 45
        );
    }

    const geometria = new THREE.BufferGeometry();

    geometria.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(posiciones, 3)
    );

    escena.add(new THREE.Points(
        geometria,
        new THREE.PointsMaterial({
            color: 0xe4d6ff,
            size: 0.85
        })
    ));

    const planeta = esfera(
        16,
        material(0x6c42b6),
        -105,
        65,
        125
    );

    planeta.castShadow = false;

    const anillo = new THREE.Mesh(
        new THREE.TorusGeometry(23, 1.1, 8, 72),
        MAT.azul
    );

    anillo.position.copy(planeta.position);
    anillo.rotation.x = 1.15;
    escena.add(anillo);
}

function crearNaves() {
    for (let i = 0; i < 7; i++) {
        const nave = new THREE.Group();

        const cuerpo = new THREE.Mesh(
            new THREE.ConeGeometry(0.8, 2.5, 4),
            MAT.metal
        );

        cuerpo.rotation.x = Math.PI / 2;
        nave.add(cuerpo);

        caja(3.3, 0.1, 0.55, MAT.azul, 0, 0, 0, nave);

        nave.position.set(
            -70 + Math.random() * 140,
            17 + Math.random() * 22,
            Math.random() * 110
        );

        escena.add(nave);

        naves.push({
            objeto: nave,
            velocidad: 5 + Math.random() * 7,
            altura: nave.position.y,
            fase: Math.random() * 6
        });
    }
}

// ============================================================
// 7. SUELO Y MAPA
// ============================================================

function crearSuelo(inicio, final, padre) {
    const longitud = final - inicio;

    caja(
        CONFIG.anchoMapa,
        0.35,
        longitud,
        MAT.suelo,
        0,
        -0.25,
        (inicio + final) / 2,
        padre
    );

    // Acera izquierda y derecha, no toda una plataforma azul.

    for (const lado of [-1, 1]) {
        caja(
            2.4,
            0.18,
            longitud,
            MAT.acera,
            lado * 11.2,
            -0.12,
            (inicio + final) / 2,
            padre
        );
    }
}

function crearCarretera(inicio, final, velocidad, padre) {
    const centro = (inicio + final) / 2;
    const longitud = final - inicio;

    // Una avenida ancha que continua hacia los lados.
    // No se construyen edificios dentro de este corredor.

    caja(
        CONFIG.anchoCarretera,
        0.12,
        longitud,
        MAT.carretera,
        0,
        -0.04,
        centro,
        padre
    );

    // Bordes de la carretera.

    for (const z of [inicio, final]) {
        caja(
            CONFIG.anchoCarretera,
            0.035,
            0.08,
            MAT.linea,
            0,
            0.04,
            z,
            padre
        );
    }

    // Lineas discontinuas de carril.

    for (let z = inicio + 1.4; z < final - 0.5; z += 2.1) {
        for (let x = -24; x < 25; x += 5) {
            caja(
                2,
                0.015,
                0.055,
                MAT.amarillo,
                x,
                0.03,
                z,
                padre
            );
        }
    }

    // Carriles con espacios para que el jugador pueda cruzar.

    let fila = 0;

    for (let z = inicio + 1.1; z < final - 0.4; z += 2.3) {
        const direccion = fila % 2 === 0 ? 1 : -1;

        crearVehiculo(
            -14 + Math.random() * 8,
            z,
            velocidad * direccion,
            padre
        );

        crearVehiculo(
            9 + Math.random() * 8,
            z,
            velocidad * direccion,
            padre
        );

        fila++;
    }
}

// ============================================================
// 8. AGUA Y TRONCOS
// ============================================================

function crearRio(inicio, final, velocidad, padre) {
    aguaZonas.push({ inicio, final, padre });

    const longitud = final - inicio;
    const centro = (inicio + final) / 2;

    // Agua hundida respecto al suelo.

    caja(
        19.8,
        0.12,
        longitud,
        MAT.agua,
        0,
        -0.13,
        centro,
        padre
    );

    // Bordes visibles del rio.

    for (const x of [-9.9, 9.9]) {
        caja(
            0.16,
            0.12,
            longitud,
            MAT.bordeAgua,
            x,
            0.04,
            centro,
            padre
        );
    }

    let fila = 0;

    for (let z = inicio + 0.9; z < final; z += 1.7) {
        const direccion = fila % 2 === 0 ? 1 : -1;

        crearTronco(
            -5.5,
            z,
            velocidad * direccion,
            padre
        );

        crearTronco(
            5.5,
            z,
            velocidad * direccion,
            padre
        );

        fila++;
    }
}

function crearTronco(x, z, velocidad, padre) {
    const grupo = new THREE.Group();

    const cuerpo = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 4.8, 12),
        MAT.madera
    );

    cuerpo.rotation.z = Math.PI / 2;
    cuerpo.position.y = 0.24;
    grupo.add(cuerpo);

    for (const extremo of [-2.4, 2.4]) {
        const tapa = new THREE.Mesh(
            new THREE.CylinderGeometry(0.43, 0.43, 0.05, 12),
            MAT.maderaOscura
        );

        tapa.rotation.z = Math.PI / 2;
        tapa.position.set(extremo, 0.24, 0);
        grupo.add(tapa);
    }

    grupo.position.set(x, 0, z);
    padre.add(grupo);

    troncos.push({
        objeto: grupo,
        velocidad,
        etapa: padre
    });
}

// ============================================================
// 9. VEHICULOS FUTURISTAS
// ============================================================

function crearVehiculo(x, z, velocidad, padre) {
    const grupo = new THREE.Group();

    const color = Math.random() > 0.5 ? 0x3452a4 : 0x8b399e;

    const carroMat = material(color, 0.65, 0.3);

    caja(2.6, 0.38, 1.15, carroMat, 0, 0.45, 0, grupo);
    caja(1.35, 0.3, 0.8, MAT.metal, 0, 0.78, 0, grupo);

    // Propulsores laterales.

    for (const lado of [-1, 1]) {
        caja(
            0.42,
            0.15,
            1.3,
            MAT.azul,
            lado * 1.08,
            0.25,
            0,
            grupo
        );
    }

    caja(0.08, 0.15, 0.8, MAT.rosa, -1.33, 0.45, 0, grupo);
    caja(0.08, 0.15, 0.8, MAT.amarillo, 1.33, 0.45, 0, grupo);

    grupo.position.set(x, 0, z);
    padre.add(grupo);

    vehiculos.push({
        objeto: grupo,
        velocidad,
        etapa: padre
    });
}

// ============================================================
// 10. DECORACION CON MODELOS GLB
// ============================================================

function crearDecoracionSegura(z, padre) {
    // Estos objetos se colocan fuera de la zona jugable.

    for (const x of [-12, 12]) {
        const farola = colocarModelo(
            "farola",
            padre,
            x,
            z,
            1.3,
            4.5
        );

        if (!farola) {
            caja(0.12, 3, 0.12, MAT.metal, x, 1.5, z, padre);
            esfera(0.22, MAT.azul, x, 3.1, z, padre);
        }
    }
}

function crearPuntoDecorativo(z, padre) {
    colocarModelo("senal", padre, -13.5, z, 1.8, 5);
    colocarModelo("maquina", padre, 13.5, z + 1, 2, 3);
    colocarModelo("comida", padre, -15, z + 2, 3, 3);
}

// ============================================================
// 11. EDIFICIOS PROVISIONALES
// ============================================================

function crearEdificio(x, z, ancho, alto) {
    const grupo = new THREE.Group();

    caja(
        ancho,
        alto,
        ancho,
        material(0x141a2e, 0.25),
        0,
        alto / 2,
        0,
        grupo
    );

    // Ventanas pequeñas, en vez de franjas gigantes.

    for (let y = 2; y < alto - 1; y += 2.4) {
        for (let a = -ancho / 2 + 0.6; a < ancho / 2; a += 1.3) {
            caja(
                0.38,
                0.55,
                0.035,
                Math.random() > 0.4 ? MAT.azul : MAT.rosa,
                a,
                y,
                ancho / 2 + 0.025,
                grupo
            );
        }
    }

    grupo.position.set(x, 0, z);
    escena.add(grupo);
}

function crearCiudadLejana() {
    // Los edificios quedan fuera del recorrido de los carros,
    // que llegan hasta x = +/-29.

    for (let i = 0; i < 24; i++) {
        const lado = i % 2 === 0 ? -1 : 1;

        crearEdificio(
            lado * (42 + Math.random() * 18),
            -5 + i * 5,
            4 + Math.random() * 4,
            7 + Math.random() * 15
        );
    }
}

// ============================================================
// 12. PERSONAJE PROVISIONAL
// ============================================================

const astro = new THREE.Group();

const cuerpo = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.38, 0.7, 6, 12),
    material(0x39a9ed, 0.35)
);

cuerpo.position.y = 0.83;
astro.add(cuerpo);

esfera(
    0.42,
    material(0xeaf2ff),
    0,
    1.55,
    0,
    astro
);

caja(
    0.62,
    0.19,
    0.1,
    MAT.azul,
    0,
    1.6,
    0.37,
    astro
);

astro.position.set(0, 0, 0);
escena.add(astro);

// ============================================================
// 13. GEMAS Y CHECKPOINTS
// ============================================================

function crearGema(z, numero, padre) {
    const grupo = new THREE.Group();

    caja(7, 0.2, 3.2, MAT.acera, 0, 0.02, 0, grupo);

    const cristal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.75),
        MAT.rosa
    );

    cristal.position.y = 1.5;
    grupo.add(cristal);

    const anillo = new THREE.Mesh(
        new THREE.TorusGeometry(1.2, 0.08, 8, 48),
        MAT.azul
    );

    anillo.rotation.x = Math.PI / 2;
    anillo.position.y = 0.3;
    grupo.add(anillo);

    grupo.position.z = z;
    padre.add(grupo);

    gemasObjetos.push({
        objeto: grupo,
        cristal,
        numero,
        z,
        recogida: false,
        etapa: padre
    });
}

function crearTrofeo(z, padre) {
    const grupo = new THREE.Group();

    caja(7, 0.25, 4, MAT.acera, 0, 0.1, 0, grupo);
    caja(1.4, 0.35, 1.4, MAT.oro, 0, 0.5, 0, grupo);

    const copa = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.3, 1.3, 16),
        MAT.oro
    );

    copa.position.y = 1.45;
    grupo.add(copa);

    esfera(0.55, MAT.azul, 0, 2.25, 0, grupo);

    grupo.position.z = z;
    padre.add(grupo);

    trofeo = {
        objeto: grupo,
        z,
        etapa: padre
    };
}

// ============================================================
// 14. SIERRAS
// ============================================================

function crearSierra(x, z, velocidad, padre) {
    const grupo = new THREE.Group();

    const disco = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.18, 12),
        MAT.metal
    );

    disco.rotation.x = Math.PI / 2;
    disco.position.y = 0.85;
    grupo.add(disco);

    for (let i = 0; i < 12; i++) {
        const angulo = i * Math.PI / 6;

        const diente = new THREE.Mesh(
            new THREE.ConeGeometry(0.2, 0.45, 3),
            MAT.rosa
        );

        diente.position.set(
            Math.cos(angulo) * 0.9,
            0.85 + Math.sin(angulo) * 0.9,
            0
        );

        diente.rotation.z = angulo - Math.PI / 2;
        grupo.add(diente);
    }

    grupo.position.set(x, 0, z);
    padre.add(grupo);

    sierras.push({
        objeto: grupo,
        velocidad,
        etapa: padre
    });
}

// ============================================================
// 15. CONSTRUCCION PROGRESIVA DEL MAPA
// ============================================================

function construirMapa() {
    ETAPAS.forEach((datos, indice) => {
        const grupo = new THREE.Group();
        grupo.name = `Etapa_${indice + 1}`;

        escena.add(grupo);
        gruposEtapa.push(grupo);

        crearSuelo(datos.inicio, datos.final, grupo);

        for (const zona of datos.zonas) {
            if (zona.tipo === "carretera") {
                crearCarretera(
                    zona.inicio,
                    zona.final,
                    zona.velocidad,
                    grupo
                );
            }

            if (zona.tipo === "agua") {
                crearRio(
                    zona.inicio,
                    zona.final,
                    zona.velocidad,
                    grupo
                );
            }

            if (zona.tipo === "sierras") {
                for (let z = zona.inicio; z <= zona.final; z += 2.5) {
                    crearSierra(
                        -5 + Math.random() * 10,
                        z,
                        zona.velocidad,
                        grupo
                    );
                }
            }
        }

        if (datos.gema !== null) {
            crearGema(datos.gema, indice + 1, grupo);
        }

        if (indice === 2) {
            crearTrofeo(88, grupo);
        }

        // Decoracion solamente en franjas seguras.

        const zonasDecoracion = indice === 0
            ? [2, 11, 18, 26]
            : indice === 1
                ? [30, 39, 47, 56]
                : [60, 70, 85];

        for (const z of zonasDecoracion) {
            crearDecoracionSegura(z, grupo);
        }

        crearPuntoDecorativo(
            indice === 0 ? 2 : indice === 1 ? 56 : 85,
            grupo
        );
    });

    activarEtapa(0);
}

function activarEtapa(numero) {
    etapaActual = Math.max(etapaActual, numero);

    gruposEtapa.forEach((grupo, i) => {
        grupo.visible = i <= etapaActual;
    });
}

// ============================================================
// 16. CONTROLES
// ============================================================

window.addEventListener("keydown", e => {
    const tecla = e.key.toLowerCase();

    if (tecla.startsWith("arrow") || tecla === " " || tecla === "tab") {
        e.preventDefault();
    }

    teclas[tecla] = true;

    if (e.repeat) return;

    if (tecla === "tab") {
        modoCamara = 1 - modoCamara;
        camara.fov = modoCamara === 0 ? 65 : 78;
        camara.updateProjectionMatrix();
        actualizarHUD();
    }

    if (tecla === "p" || tecla === "escape") {
        cambiarPausa();
    }

    if (
        tecla === " " &&
        estado === "jugando" &&
        enSuelo
    ) {
        velocidadY = CONFIG.salto;
        enSuelo = false;
    }
});

window.addEventListener("keyup", e => {
    teclas[e.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
    Object.keys(teclas).forEach(k => {
        teclas[k] = false;
    });
});

// ============================================================
// 17. MOVIMIENTO DEL JUGADOR
// ============================================================

function actualizarJugador(dt) {
    let dx = 0;
    let dz = 0;

    // Mantenemos exactamente tus controles.

    if (teclas["w"] || teclas["arrowup"]) dz++;
    if (teclas["s"] || teclas["arrowdown"]) dz--;
    if (teclas["a"] || teclas["arrowright"]) dx++;
    if (teclas["d"] || teclas["arrowleft"]) dx--;

    const longitud = Math.hypot(dx, dz);

    if (longitud > 0) {
        dx /= longitud;
        dz /= longitud;

        astro.position.x +=
            dx * CONFIG.velocidadJugador * dt;

        astro.position.z +=
            dz * CONFIG.velocidadJugador * dt;

        astro.rotation.y = Math.atan2(dx, dz);
    }

    astro.position.x = THREE.MathUtils.clamp(
        astro.position.x,
        -CONFIG.limiteX,
        CONFIG.limiteX
    );

    astro.position.z = THREE.MathUtils.clamp(
        astro.position.z,
        Math.max(0, checkpoint.z - 1.5),
        ETAPAS[etapaActual].final - 0.8
    );

    if (!enSuelo) {
        velocidadY -= CONFIG.gravedad * dt;
        astro.position.y += velocidadY * dt;

        if (astro.position.y <= 0) {
            astro.position.y = 0;
            velocidadY = 0;
            enSuelo = true;
        }
    }

    invulnerable = Math.max(0, invulnerable - dt);

    astro.visible =
        modoCamara === 0 &&
        (
            invulnerable <= 0 ||
            Math.floor(invulnerable * 10) % 2 === 0
        );
}

// ============================================================
// 18. ACTUALIZAR OBSTACULOS
// ============================================================

function actualizarObstaculos(dt) {
    for (const carro of vehiculos) {
        if (!carro.etapa.visible) continue;

        carro.objeto.position.x += carro.velocidad * dt;

        if (carro.velocidad > 0 &&
            carro.objeto.position.x > CONFIG.limiteVehiculos) {
            carro.objeto.position.x = -CONFIG.limiteVehiculos;
        }

        if (carro.velocidad < 0 &&
            carro.objeto.position.x < -CONFIG.limiteVehiculos) {
            carro.objeto.position.x = CONFIG.limiteVehiculos;
        }
    }

    for (const tronco of troncos) {
        if (!tronco.etapa.visible) continue;

        tronco.objeto.position.x += tronco.velocidad * dt;

        if (tronco.velocidad > 0 && tronco.objeto.position.x > 13) {
            tronco.objeto.position.x = -13;
        }

        if (tronco.velocidad < 0 && tronco.objeto.position.x < -13) {
            tronco.objeto.position.x = 13;
        }
    }

    for (const sierra of sierras) {
        if (!sierra.etapa.visible) continue;

        sierra.objeto.rotation.z += dt * 5;
        sierra.objeto.position.x += sierra.velocidad * dt;

        if (sierra.objeto.position.x > 8) {
            sierra.velocidad = -Math.abs(sierra.velocidad);
        }

        if (sierra.objeto.position.x < -8) {
            sierra.velocidad = Math.abs(sierra.velocidad);
        }
    }
}

// ============================================================
// 19. COLISIONES Y CHECKPOINTS
// ============================================================

function perderVida() {
    if (invulnerable > 0 || estado !== "jugando") return;

    vidas--;

    if (vidas <= 0) {
        actualizarHUD();
        finalizar(false);
        return;
    }

    astro.position.copy(checkpoint);
    velocidadY = 0;
    enSuelo = true;
    invulnerable = CONFIG.invulnerabilidad;

    actualizarHUD();
}

function comprobarColisiones(dt) {
    const x = astro.position.x;
    const z = astro.position.z;

    for (const carro of vehiculos) {
        if (!carro.etapa.visible) continue;

        if (
            Math.abs(x - carro.objeto.position.x) < 1.55 &&
            Math.abs(z - carro.objeto.position.z) < 0.8 &&
            astro.position.y < 0.8
        ) {
            perderVida();
            return;
        }
    }

    const rio = aguaZonas.find(
        zona =>
            zona.padre.visible &&
            z >= zona.inicio &&
            z <= zona.final
    );

    if (rio && astro.position.y < 0.45) {
        let sobreTronco = false;

        for (const tronco of troncos) {
            if (!tronco.etapa.visible) continue;

            if (
                Math.abs(x - tronco.objeto.position.x) < 2.25 &&
                Math.abs(z - tronco.objeto.position.z) < 0.62
            ) {
                astro.position.x += tronco.velocidad * dt;
                sobreTronco = true;
                break;
            }
        }

        if (!sobreTronco) {
            perderVida();
            return;
        }
    }

    for (const sierra of sierras) {
        if (!sierra.etapa.visible) continue;

        if (
            Math.abs(x - sierra.objeto.position.x) < 1.1 &&
            Math.abs(z - sierra.objeto.position.z) < 0.8 &&
            astro.position.y < 1.4
        ) {
            perderVida();
            return;
        }
    }

    for (const gema of gemasObjetos) {
        if (gema.recogida || !gema.etapa.visible) continue;

        if (
            Math.abs(x) < 2.5 &&
            Math.abs(z - gema.z) < 1.5
        ) {
            gema.recogida = true;
            gema.cristal.visible = false;

            gemas++;
            puntos += 500;

            checkpoint.set(0, 0, gema.z);

            if (gema.numero === 1) activarEtapa(1);
            if (gema.numero === 2) activarEtapa(2);

            actualizarHUD();
        }
    }

    if (
        trofeo &&
        trofeo.etapa.visible &&
        gemas === 2 &&
        Math.abs(x) < 2.5 &&
        Math.abs(z - trofeo.z) < 2
    ) {
        puntos += 1000;
        finalizar(true);
    }
}

// ============================================================
// 20. CAMARA ELEVADA Y PRIMERA PERSONA
// ============================================================

const destinoCamara = new THREE.Vector3();
const mirar = new THREE.Vector3();

function actualizarCamara(dt) {
    if (modoCamara === 0) {
        // Mas cerca del personaje que en la version anterior.

        destinoCamara.set(
            astro.position.x,
            astro.position.y + 5.2,
            astro.position.z - 7
        );

        mirar.set(
            astro.position.x,
            astro.position.y + 0.8,
            astro.position.z + 5
        );
    } else {
        destinoCamara.set(
            astro.position.x,
            astro.position.y + 1.65,
            astro.position.z + 0.1
        );

        mirar.set(
            astro.position.x,
            astro.position.y + 1.65,
            astro.position.z + 12
        );
    }

    const factor = 1 - Math.exp(
        -CONFIG.camaraSuavidad * dt
    );

    camara.position.lerp(destinoCamara, factor);
    camara.lookAt(mirar);
}

// ============================================================
// 21. ANIMACION AMBIENTAL
// ============================================================

function actualizarAmbiente(dt) {
    for (const nave of naves) {
        nave.objeto.position.x += nave.velocidad * dt;

        nave.objeto.position.y =
            nave.altura +
            Math.sin(tiempoGlobal + nave.fase) * 0.6;

        if (nave.objeto.position.x > 95) {
            nave.objeto.position.x = -95;
        }
    }

    for (const gema of gemasObjetos) {
        if (!gema.recogida && gema.etapa.visible) {
            gema.cristal.rotation.y += dt * 1.5;
            gema.cristal.position.y =
                1.5 + Math.sin(tiempoGlobal * 2) * 0.15;
        }
    }
}

// ============================================================
// 22. JUEGO
// ============================================================

function iniciarJuego() {
    estado = "jugando";

    vidas = CONFIG.vidas;
    puntos = 0;
    gemas = 0;
    tiempo = CONFIG.tiempo;
    etapaActual = 0;
    invulnerable = 0;
    velocidadY = 0;
    enSuelo = true;

    checkpoint.set(0, 0, 0);
    astro.position.copy(checkpoint);

    gruposEtapa.forEach((grupo, i) => {
        grupo.visible = i === 0;
    });

    gemasObjetos.forEach(gema => {
        gema.recogida = false;
        gema.cristal.visible = true;
    });

    actualizarHUD();

    if (overlay) overlay.style.display = "none";
    if (pausaPanel) pausaPanel.style.display = "none";
}

function cambiarPausa() {
    if (estado === "jugando") {
        estado = "pausa";
        if (pausaPanel) pausaPanel.style.display = "flex";
    } else if (estado === "pausa") {
        estado = "jugando";
        if (pausaPanel) pausaPanel.style.display = "none";
    }
}

function finalizar(victoria) {
    estado = victoria ? "victoria" : "derrota";

    mostrarMenu(
        victoria ? "MISION COMPLETADA" : "GAME OVER",
        victoria ? "Has conseguido el trofeo" : "Fin del recorrido",
        `Gemas: ${gemas}/2 - Puntos: ${puntos}`,
        "Volver a jugar"
    );
}

obtener("btnJugar")?.addEventListener("click", iniciarJuego);
obtener("btnContinuar")?.addEventListener("click", cambiarPausa);

// ============================================================
// 23. BUCLE PRINCIPAL
// ============================================================

function animar(ms) {
    requestAnimationFrame(animar);

    const dt = Math.min(
        (ms - ultimoTiempo) / 1000 || 0,
        0.05
    );

    ultimoTiempo = ms;

    if (estado === "jugando") {
        tiempoGlobal += dt;
        tiempo -= dt;

        actualizarJugador(dt);
        actualizarObstaculos(dt);
        comprobarColisiones(dt);
        actualizarAmbiente(dt);

        if (tiempo <= 0 && estado === "jugando") {
            tiempo = 0;
            finalizar(false);
        }

        actualizarHUD();
    }

    actualizarCamara(dt);
    renderer.render(escena, camara);
}

// ============================================================
// 24. PANTALLA
// ============================================================

window.addEventListener("resize", () => {
    camara.aspect =
        window.innerWidth / window.innerHeight;

    camara.updateProjectionMatrix();

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );
});

// ============================================================
// 25. INICIALIZAR
// ============================================================

async function inicializar() {
    crearGalaxia();
    crearNaves();

    await cargarModelos();

    crearCiudadLejana();
    construirMapa();

    camara.position.set(0, 5.2, -7);
    camara.lookAt(0, 0.8, 5);

    actualizarHUD();

    mostrarMenu(
        "ASTRO & BOLT",
        "CRUCE IMPOSIBLE 3D",
        "Consigue dos gemas, activa los checkpoints y alcanza el trofeo.",
        "Jugar"
    );

    requestAnimationFrame(animar);
}

inicializar();