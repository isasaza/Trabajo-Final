import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

// =====================================================
// 01. CONFIGURACION GENERAL
// =====================================================

const CONFIG = {
    vidas: 3,
    tiempo: 240,
    velocidadJugador: 6,
    salto: 7,
    gravedad: 18,
    limiteX: 8,
    velocidadCamara: 8,
    invulnerabilidad: 1.5,
    limiteMoviles: 23
};

const TRAMOS = [
    {
        id: 0,
        inicio: 0,
        fin: 23,
        carros: 2.5,
        troncos: 1.4,
        zonas: [
            ["suelo", 0, 3],
            ["carretera", 4, 8],
            ["agua", 9, 13],
            ["suelo", 14, 15],
            ["carretera", 16, 20],
            ["checkpoint", 21, 23]
        ]
    },
    {
        id: 1,
        inicio: 24,
        fin: 47,
        carros: 4.2,
        troncos: 1.9,
        zonas: [
            ["suelo", 24, 26],
            ["carretera", 27, 31],
            ["agua", 32, 36],
            ["suelo", 37, 39],
            ["carretera", 40, 44],
            ["checkpoint", 45, 47]
        ]
    },
    {
        id: 2,
        inicio: 48,
        fin: 73,
        carros: 6,
        troncos: 2.5,
        zonas: [
            ["suelo", 48, 50],
            ["carretera", 51, 55],
            ["sierras", 56, 59],
            ["agua", 60, 64],
            ["carretera", 65, 69],
            ["sierras", 70, 71],
            ["trofeo", 72, 73]
        ]
    }
];

const ESTADO = {
    INICIO: "inicio",
    JUEGO: "juego",
    PAUSA: "pausa",
    FIN: "fin",
    VICTORIA: "victoria"
};

let estado = ESTADO.INICIO;
let vidas = CONFIG.vidas;
let tiempo = CONFIG.tiempo;
let puntos = 0;
let gemasRecogidas = 0;
let tramoActual = 0;
let checkpointZ = 0;
let invulnerable = 0;
let velocidadVertical = 0;
let relojMundo = 0;
let modoCamara = 0;
let trofeo = null;

const teclas = {};
const tramosCreados = new Set();
const filasAgua = new Set();
const gruposTramo = new Map();

const vehiculos = [];
const troncos = [];
const sierras = [];
const gemas = [];
const particulas = [];
const naves = [];

const reloj = new THREE.Clock();

// =====================================================
// 02. ESCENA Y RENDERIZADOR
// =====================================================

const escena = new THREE.Scene();

escena.background = new THREE.Color(0x080b24);
escena.fog = new THREE.FogExp2(0x111832, 0.006);

const camara = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    300
);

camara.position.set(0, 7, -9);

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;

document.getElementById("game-container")
    .appendChild(renderer.domElement);

// =====================================================
// 03. ILUMINACION
// =====================================================

escena.add(
    new THREE.HemisphereLight(
        0x9baaff,
        0x253352,
        1.8
    )
);

const sol = new THREE.DirectionalLight(0xc4d9ff, 2.1);

sol.position.set(-18, 30, 12);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);

sol.shadow.camera.left = -35;
sol.shadow.camera.right = 35;
sol.shadow.camera.top = 85;
sol.shadow.camera.bottom = -35;

escena.add(sol);

// =====================================================
// 04. MATERIALES Y GEOMETRIAS
// =====================================================

function mat(color, metal = 0.1, brillo = 0) {
    return new THREE.MeshStandardMaterial({
        color,
        metalness: metal,
        roughness: metal > 0.3 ? 0.32 : 0.8,
        emissive: color,
        emissiveIntensity: brillo
    });
}

const M = {
    pasto: mat(0x214d56),
    carretera: mat(0x22293e, 0.2),
    agua: mat(0x076a9c, 0.45, 0.17),
    plataforma: mat(0x1c5666, 0.3),
    metal: mat(0x39415c, 0.7),
    oscuro: mat(0x10192c, 0.6),
    casco: mat(0xe8f5ff),
    traje: mat(0xff9c37, 0.25),
    visor: mat(0x22dfff, 0.5, 1.2),
    madera: mat(0x7c5361),
    oro: mat(0xffc75d, 0.65, 0.45),
    sierra: mat(0xb7c6e0, 0.8),
    rosa: mat(0xff49c7, 0.2, 1.4),
    cian: mat(0x27edff, 0.2, 1.4),
    violeta: mat(0x9c6dff, 0.2, 1.4),
    rojo: mat(0xff4567, 0.2, 0.8)
};

function caja(w, h, d, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
}

function esfera(r, material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 12),
        material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;

    return mesh;
}

function cilindro(
    r1, r2, h, material,
    x = 0, y = 0, z = 0, lados = 12
) {
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(r1, r2, h, lados),
        material
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;

    return mesh;
}

function bordeNeon(geometria, color) {
    return new THREE.LineSegments(
        new THREE.EdgesGeometry(geometria),
        new THREE.LineBasicMaterial({ color })
    );
}

function anillo(radio, material, y = 0) {
    const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(radio, 0.08, 6, 24),
        material
    );

    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;

    return mesh;
}

function azar(semilla) {
    const n = Math.sin(semilla * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
}

// =====================================================
// 05. CIELO GALACTICO Y ESTRELLAS
// =====================================================

const cielo = new THREE.Group();
escena.add(cielo);

const posicionesEstrellas = [];

for (let i = 0; i < 1500; i++) {
    const angulo = azar(i + 1) * Math.PI * 2;
    const elevacion = 0.1 + azar(i + 2000) * 1.25;
    const radio = 150;

    posicionesEstrellas.push(
        Math.cos(angulo) * Math.cos(elevacion) * radio,
        Math.sin(elevacion) * radio,
        Math.sin(angulo) * Math.cos(elevacion) * radio
    );
}

const geoEstrellas = new THREE.BufferGeometry();

geoEstrellas.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(posicionesEstrellas, 3)
);

cielo.add(
    new THREE.Points(
        geoEstrellas,
        new THREE.PointsMaterial({
            color: 0xddeaff,
            size: 0.65,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            fog: false
        })
    )
);

// =====================================================
// 06. PLANETAS
// =====================================================

function planeta(x, y, z, radio, color, conAnillos = false) {
    const grupo = new THREE.Group();

    const cuerpo = new THREE.Mesh(
        new THREE.SphereGeometry(radio, 32, 24),
        new THREE.MeshBasicMaterial({
            color,
            fog: false
        })
    );

    grupo.add(cuerpo);

    if (conAnillos) {
        const aro = new THREE.Mesh(
            new THREE.RingGeometry(
                radio * 1.3,
                radio * 1.8,
                64
            ),
            new THREE.MeshBasicMaterial({
                color: 0x9b8dff,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
                fog: false
            })
        );

        aro.rotation.x = 0.9;
        grupo.add(aro);
    }

    grupo.position.set(x, y, z);
    cielo.add(grupo);

    return grupo;
}

const planetaGrande = planeta(
    -65, 55, 110, 18, 0x6651bd, true
);

planeta(90, 37, 95, 9, 0x24a7bd);

// =====================================================
// 07. NEBULOSAS PROCEDIMENTALES
// =====================================================

const canvasNebula = document.createElement("canvas");

canvasNebula.width = 128;
canvasNebula.height = 128;

const nc = canvasNebula.getContext("2d");

const grad = nc.createRadialGradient(
    64, 64, 3,
    64, 64, 64
);

grad.addColorStop(0, "rgba(255,255,255,0.45)");
grad.addColorStop(0.45, "rgba(255,255,255,0.16)");
grad.addColorStop(1, "rgba(255,255,255,0)");

nc.fillStyle = grad;
nc.fillRect(0, 0, 128, 128);

const texturaNebula = new THREE.CanvasTexture(canvasNebula);

for (let i = 0; i < 14; i++) {
    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: texturaNebula,
            color: [
                0x8b4bff,
                0x2b95ff,
                0xee4cc7
            ][i % 3],
            transparent: true,
            opacity: 0.28,
            depthWrite: false,
            fog: false
        })
    );

    sprite.position.set(
        -100 + i * 16,
        35 + azar(i + 90) * 35,
        100 + azar(i + 30) * 35
    );

    sprite.scale.set(55, 34, 1);
    cielo.add(sprite);
}

// =====================================================
// 08. EDIFICIOS FUTURISTAS CON NEON
// =====================================================

function edificioNeon(x, z, altura, color, tipo = 0) {
    const grupo = new THREE.Group();
    const luz = mat(color, 0.2, 1.5);

    if (tipo === 1) {

        // Torre de control circular
        grupo.add(
            cilindro(
                1.6, 2.2, altura,
                M.oscuro,
                0, altura / 2, 0, 10
            )
        );

        grupo.add(
            cilindro(
                2.5, 2.1, 1.2,
                M.metal,
                0, altura * 0.78, 0
            )
        );

        grupo.add(
            cilindro(
                2.15, 2.15, 0.65,
                luz,
                0, altura * 0.79, 0
            )
        );

        for (let y = 3; y < altura; y += 4) {
            grupo.add(anillo(2.15, luz, y));
        }

        grupo.add(
            cilindro(
                0.09, 0.09, 2.5,
                luz,
                0, altura + 1, 0
            )
        );

    } else if (tipo === 2) {

        // Edificio escalonado
        const partes = [
            [4.6, altura * 0.4, 4.1, 0],
            [3.5, altura * 0.35, 3.2, altura * 0.4],
            [2.3, altura * 0.25, 2.3, altura * 0.75]
        ];

        for (const [w, h, d, base] of partes) {
            const cuerpo = caja(
                w, h, d,
                M.oscuro,
                0, base + h / 2, 0
            );

            grupo.add(cuerpo);

            const bordes = bordeNeon(
                cuerpo.geometry,
                color
            );

            bordes.position.copy(cuerpo.position);
            grupo.add(bordes);
        }

        grupo.add(
            esfera(0.35, luz, 0, altura + 0.3, 0)
        );

    } else {

        // Rascacielos rectangular
        const geo = new THREE.BoxGeometry(
            3.6, altura, 3.6
        );

        const cuerpo = new THREE.Mesh(
            geo,
            M.oscuro
        );

        cuerpo.position.y = altura / 2;
        cuerpo.castShadow = true;

        grupo.add(cuerpo);

        const bordes = bordeNeon(geo, color);
        bordes.position.y = altura / 2;

        grupo.add(bordes);

        for (let y = 2.5; y < altura; y += 3.5) {
            grupo.add(
                caja(
                    3.85, 0.1, 3.85,
                    luz,
                    0, y, 0
                )
            );
        }

        grupo.add(
            cilindro(
                0.07, 0.07, 2.2,
                luz,
                0, altura + 1.1, 0
            )
        );
    }

    grupo.position.set(x, 0, z);

    grupo.traverse(obj => {
        if (obj.isMesh) {
            obj.castShadow = true;
        }
    });

    return grupo;
}

// =====================================================
// 09. DISTRIBUCION DE LA CIUDAD
// =====================================================

function decorarTramo(grupo, tramo) {
    const colores = [
        0x27edff,
        0xff49c7,
        0x9c6dff
    ];

    for (let z = tramo.inicio; z <= tramo.fin; z += 4) {
        for (const lado of [-1, 1]) {
            const seed = z * 7 + lado * 37 + 100;

            const altura =
                6 + Math.floor(azar(seed) * 19);

            const x =
                lado * (14 + azar(seed + 4) * 5);

            const tipo =
                Math.floor(azar(seed + 7) * 3);

            const color = colores[
                Math.floor(azar(seed + 9) * 3)
            ];

            grupo.add(
                edificioNeon(
                    x, z, altura, color, tipo
                )
            );
        }
    }

    // Columnas luminosas en las zonas seguras
    for (const [tipo, inicio, fin] of tramo.zonas) {
        if (
            tipo !== "suelo" &&
            tipo !== "checkpoint"
        ) {
            continue;
        }

        for (let z = inicio; z <= fin; z += 3) {
            for (const x of [-8.3, 8.3]) {

                // Farola GLB (si cargo); si no, la de cilindro y esfera
                if (modeloFarola) {
                    const farola = modeloFarola.clone(true);

                    farola.position.set(x, 0, z);

                    // El brazo de la farola mira hacia el centro de la calle
                    farola.rotation.y =
                        ROTACION_FAROLA + (x > 0 ? Math.PI : 0);

                    grupo.add(farola);
                    continue;
                }

                grupo.add(
                    cilindro(
                        0.08, 0.12, 2.5,
                        M.metal,
                        x, 1.25, z
                    )
                );

                grupo.add(
                    esfera(
                        0.18, M.cian,
                        x, 2.6, z
                    )
                );
            }
        }
    }
}

// =====================================================
// 10. NAVES ESPACIALES
// =====================================================

function crearNave(i) {
    const grupo = new THREE.Group();

    grupo.add(esfera(0.85, M.metal));

    grupo.add(
        caja(
            3.2, 0.15, 0.9,
            M.oscuro,
            0, -0.1, 0
        )
    );

    grupo.add(
        esfera(0.4, M.visor, 0, 0.2, 0.45)
    );

    for (const x of [-1.45, 1.45]) {
        grupo.add(
            esfera(0.16, M.rosa, x, -0.1, 0)
        );
    }

    const z = 8 + i * 14;
    const y = 12 + (i % 4) * 5;

    const velocidad =
        (i % 2 === 0 ? 1 : -1) *
        (3 + (i % 4));

    grupo.position.set(
        (i % 2 === 0 ? -1 : 1) * 38,
        y,
        z
    );

    grupo.rotation.y =
        velocidad > 0 ? Math.PI / 2 : -Math.PI / 2;

    escena.add(grupo);

    naves.push({
        mesh: grupo,
        velocidad,
        baseY: y,
        fase: i * 1.7
    });
}

for (let i = 0; i < 9; i++) {
    crearNave(i);
}

function actualizarNaves(dt) {
    for (const nave of naves) {
        nave.mesh.position.x += nave.velocidad * dt;

        nave.mesh.position.y =
            nave.baseY +
            Math.sin(relojMundo * 1.4 + nave.fase) * 0.5;

        if (nave.mesh.position.x > 48) {
            nave.mesh.position.x = -48;
        }

        if (nave.mesh.position.x < -48) {
            nave.mesh.position.x = 48;
        }
    }
}

// =====================================================
// 11. ASTRO ORIGINAL
// =====================================================

const astro = new THREE.Group();

astro.add(
    caja(
        0.65, 0.85, 0.42,
        M.traje,
        0, 1.05, 0
    )
);

astro.add(
    esfera(0.46, M.casco, 0, 1.75, 0)
);

astro.add(
    caja(
        0.65, 0.23, 0.13,
        M.visor,
        0, 1.77, 0.42
    )
);

const brazoI = caja(
    0.2, 0.65, 0.25,
    M.metal,
    -0.48, 1.08, 0
);

const brazoD = caja(
    0.2, 0.65, 0.25,
    M.metal,
    0.48, 1.08, 0
);

const piernaI = caja(
    0.23, 0.65, 0.3,
    M.oscuro,
    -0.2, 0.35, 0
);

const piernaD = caja(
    0.23, 0.65, 0.3,
    M.oscuro,
    0.2, 0.35, 0
);

astro.add(brazoI, brazoD, piernaI, piernaD);
escena.add(astro);

// =====================================================
// 12. BOLT ORIGINAL
// =====================================================

const bolt = new THREE.Group();

bolt.add(esfera(0.33, M.casco));
bolt.add(esfera(0.17, M.visor, 0, 0, 0.3));

bolt.add(
    caja(
        0.8, 0.07, 0.16,
        M.metal,
        0, -0.08, 0
    )
);

bolt.position.set(1, 1.8, -0.6);
escena.add(bolt);

// =====================================================
// 13. VEHICULOS
// =====================================================

// --- Karts (OBJ + MTL + PNG) --------------------------------------
// Estructura: models/<carpeta>/Full Car/<archivo>.obj
// IMPORTANTE: las rutas deben ser IGUALES al nombre real (mayusculas incluidas).
// Si el archivo se llama distinto a la carpeta con "_", ponlo como segundo valor.
function rutaKart(carpeta, archivo = carpeta.replace(/ /g, "_")) {
    return `models/${carpeta}/Full Car/${archivo}.obj`;
}

const RUTAS_CARROS = [
    rutaKart("Black-Gold Kart"),
    rutaKart("Black Gray Kart"),
    rutaKart("Marron Kart"),
    rutaKart("Green_Reptile"),
    rutaKart("Multi-Red Kart"),
    rutaKart("Midnight-Black Kart"),
    rutaKart("Orange Purple Kart"),
    rutaKart("Pink Kart"),
    rutaKart("Red Kart"),
    rutaKart("Police Kart"),
    rutaKart("Yellow 6 Wheeler")
];

const LARGO_CARRO = 2.6;      // largo en el juego (la colision usa ~2.8)
const ANCHO_CARRO = 1.2;      // ancho maximo: cabe dentro de su carril
const ROTACION_EXTRA = 0;     // si salen de lado o de reversa: Math.PI, Math.PI / 2, -Math.PI / 2
const ROTACION_X = 0;         // si salen acostados o boca abajo: -Math.PI / 2 o Math.PI / 2

const modelosCarro = [];

async function cargarModeloOBJ(ruta) {
    const corte = ruta.lastIndexOf("/") + 1;
    const dir = encodeURI(ruta.substring(0, corte));
    const nombre = ruta.substring(corte, ruta.lastIndexOf("."));

    const mtlLoader = new MTLLoader();
    mtlLoader.setPath(dir);

    const materiales = await mtlLoader.loadAsync(nombre + ".mtl");
    materiales.preload();

    // Estilo voxel: texturas sin suavizar para que los colores se vean nitidos
    for (const m of Object.values(materiales.materials)) {
        if (m.map) {
            m.map.magFilter = THREE.NearestFilter;
            m.map.minFilter = THREE.NearestFilter;
            m.map.colorSpace = THREE.SRGBColorSpace;
            m.map.needsUpdate = true;
        }
    }

    const objLoader = new OBJLoader();
    objLoader.setPath(dir);
    objLoader.setMaterials(materiales);

    return objLoader.loadAsync(nombre + ".obj");
}

function normalizarModelo(modelo, largoDeseado) {
    modelo.rotation.x = ROTACION_X;
    const caja3 = new THREE.Box3().setFromObject(modelo);
    const tam = caja3.getSize(new THREE.Vector3());
    const centro = caja3.getCenter(new THREE.Vector3());

    // Escala uniforme: respeta el largo y no pasa del ancho del carril
    const escala = Math.min(
        largoDeseado / Math.max(tam.x, tam.z),
        ANCHO_CARRO / Math.min(tam.x, tam.z)
    );

    modelo.scale.setScalar(escala);
    modelo.position.set(
        -centro.x * escala,
        -caja3.min.y * escala,
        -centro.z * escala
    );

    modelo.traverse(o => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });

    const pivote = new THREE.Group();
    pivote.add(modelo);
    return pivote;
}

// --- Farola GLB ---------------------------------------------------
const RUTA_FAROLA = "models/street_lamp.glb";
const ALTO_FAROLA = 3.2;      // altura de la farola en el juego
const ROTACION_FAROLA = 0;    // si el brazo/luz mira hacia afuera: Math.PI; de lado: Math.PI / 2

let modeloFarola = null;

async function cargarFarola() {
    try {
        const gltf = await new GLTFLoader().loadAsync(RUTA_FAROLA);
        const modelo = gltf.scene;

        const caja3 = new THREE.Box3().setFromObject(modelo);
        const tam = caja3.getSize(new THREE.Vector3());
        const centro = caja3.getCenter(new THREE.Vector3());

        const escala = ALTO_FAROLA / tam.y;

        modelo.scale.setScalar(escala);
        modelo.position.set(
            -centro.x * escala,
            -caja3.min.y * escala,
            -centro.z * escala
        );

        modelo.traverse(o => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });

        const pivote = new THREE.Group();
        pivote.add(modelo);
        modeloFarola = pivote;

    } catch (err) {
        console.warn("No se pudo cargar " + RUTA_FAROLA, err);
    }
}

// --- Drone GLB (reemplaza a Bolt) ---------------------------------
const RUTA_DRONE = "models/drone.glb";
const TAMANO_DRONE = 1.1;       // lado mas largo del drone en el juego
const ROTACION_DRONE = 0;       // si mira de lado o de espaldas: Math.PI, Math.PI / 2 o -Math.PI / 2

let mixerDrone = null;
const helicesDrone = [];        // helices sueltas del modelo (si tiene)

async function cargarDrone() {
    try {
        const gltf = await new GLTFLoader().loadAsync(RUTA_DRONE);
        const modelo = gltf.scene;

        const caja3 = new THREE.Box3().setFromObject(modelo);
        const tam = caja3.getSize(new THREE.Vector3());
        const centro = caja3.getCenter(new THREE.Vector3());

        const escala = TAMANO_DRONE / Math.max(tam.x, tam.y, tam.z);

        // Centrado en su propio origen: Bolt ya lo hace flotar a su altura
        modelo.scale.setScalar(escala);
        modelo.position.set(
            -centro.x * escala,
            -centro.y * escala,
            -centro.z * escala
        );

        modelo.traverse(o => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
                o.frustumCulled = false;
            }

            // Helices sueltas: giran solas aunque el GLB no traiga animacion
            if (/prop|rotor|blade|helice|fan/i.test(o.name || "")) {
                helicesDrone.push(o);
            }
        });

        const pivote = new THREE.Group();
        pivote.rotation.y = ROTACION_DRONE;
        pivote.add(modelo);

        // Se esconde la bolita de antes y se usa el drone
        for (const hijo of bolt.children) {
            hijo.visible = false;
        }

        bolt.add(pivote);

        // Animaciones del GLB (si trae): se reproducen todas en bucle
        if (gltf.animations.length > 0) {
            mixerDrone = new THREE.AnimationMixer(modelo);

            for (const clip of gltf.animations) {
                mixerDrone.clipAction(clip).play();
            }
        }

        console.log(
            "Drone cargado. Animaciones:",
            gltf.animations.map(c => c.name),
            "Helices:",
            helicesDrone.map(h => h.name)
        );

    } catch (err) {
        console.warn("No se pudo cargar " + RUTA_DRONE, err);
    }
}

// --- Personaje GLB (Astro = robot) --------------------------------
const RUTA_PERSONAJE = "models/robot.glb";
const ALTO_ASTRO = 2.2;          // altura en el juego (el de cajas media ~2.2)
const ROTACION_ASTRO = -Math.PI / 2;        // si mira de lado o de espaldas: Math.PI / 2, -Math.PI / 2 o Math.PI

let mixerAstro = null;
let accionCaminar = null;
let accionReposo = null;
let astroMoviendo = null;
let modeloRobot = null;
let baseRobotY = 0;
let faseCaminar = 0;
let fuerzaCaminar = 0;

const partesRobot = [];   // piernas y brazos encontrados en el GLB (si tiene)

const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const qTemp = new THREE.Quaternion();

// Busca piernas/pies y brazos por nombre y prepara su balanceo
function buscarPartesRobot(modelo) {
    modelo.updateWorldMatrix(true, true);

    const encontradas = [];
    const v = new THREE.Vector3();

    modelo.traverse(o => {
        if (o === modelo) return;

        const n = o.name || "";

        if (/armature/i.test(n)) return;

        const esPierna = /leg|thigh|calf|shin|foot|feet|pierna|muslo|\bpie\b/i.test(n);
        const esBrazo = /arm|shoulder|hand|brazo|hombro|mano/i.test(n);

        if (!esPierna && !esBrazo) return;

        // Si algun ancestro ya se mueve, esta pieza ya va con el
        let ancestro = o.parent;

        while (ancestro) {
            if (encontradas.some(p => p.obj === ancestro)) return;
            ancestro = ancestro.parent;
        }

        o.getWorldPosition(v);
        modelo.worldToLocal(v);

        encontradas.push({
            obj: o,
            esBrazo,
            pos: v.clone()
        });
    });

    if (encontradas.length === 0) {
        console.warn(
            "No encontre piernas ni brazos por nombre. " +
            "Nombres del modelo:",
            (() => {
                const lista = [];
                modelo.traverse(o => o.name && lista.push(o.name));
                return lista;
            })()
        );
        return;
    }

    // Eje lateral del modelo (donde se separan izquierda y derecha)
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let mediaX = 0, mediaZ = 0;

    for (const e of encontradas) {
        minX = Math.min(minX, e.pos.x);
        maxX = Math.max(maxX, e.pos.x);
        minZ = Math.min(minZ, e.pos.z);
        maxZ = Math.max(maxZ, e.pos.z);
        mediaX += e.pos.x / encontradas.length;
        mediaZ += e.pos.z / encontradas.length;
    }

    const lateralEsX = (maxX - minX) >= (maxZ - minZ);
    const eje = lateralEsX ? EJE_X : EJE_Z;   // eje de balanceo (adelante-atras)

    // Eje de balanceo expresado en el espacio del padre de cada pieza
    const qModelo = new THREE.Quaternion();
    modelo.getWorldQuaternion(qModelo);

    for (const e of encontradas) {
        const qPadre = new THREE.Quaternion();
        e.obj.parent.getWorldQuaternion(qPadre);

        const lado = lateralEsX
            ? (e.pos.x >= mediaX ? 1 : -1)
            : (e.pos.z >= mediaZ ? 1 : -1);

        partesRobot.push({
            obj: e.obj,
            base: e.obj.quaternion.clone(),
            eje: eje.clone()
                .applyQuaternion(qModelo)
                .applyQuaternion(qPadre.invert())
                .normalize(),
            // lados opuestos al reves; brazos al reves que las piernas
            signo: lado * (e.esBrazo ? -1 : 1),
            amplitud: e.esBrazo ? 0.6 : 0.8
        });
    }

    console.log(
        "Partes del robot que se mueven:",
        partesRobot.map(p => p.obj.name)
    );
}

// El robot.glb es UNA sola malla, sin huesos ni animaciones. Aqui se separa por
// zonas en cuerpo, 2 piernas y 2 brazos; cada extremidad queda en un pivote
// (cadera u hombro) para poder balancearla al caminar.
function dividirRobot(modelo) {
    let malla = null;
    let cantidad = 0;

    modelo.traverse(o => {
        if (o.isMesh) {
            malla = malla || o;
            cantidad++;
        }
    });

    if (!malla || cantidad !== 1 || malla.isSkinnedMesh) return false;

    const geo = malla.geometry;
    const idx = geo.index;
    const pos = geo.attributes.position;

    if (!idx || !pos) return false;

    geo.computeBoundingBox();

    const bb = geo.boundingBox;
    const alto = bb.max.y - bb.min.y;
    const ancho = bb.max.z - bb.min.z;

    // Solo para este robot (brazos abiertos: ancho ~ 0.88 del alto)
    if (
        Math.abs(ancho / alto - 0.877) > 0.1 ||
        Math.abs((bb.max.z + bb.min.z) / 2) > alto * 0.05
    ) {
        return false;
    }

    // Las zonas estan medidas en unidades donde el robot mide 35.47 de alto
    const u = alto / 35.47;
    const baseY = bb.min.y;

    // 0 cuerpo | 1 pierna (-z) | 2 pierna (+z) | 3 brazo (-z) | 4 brazo (+z)
    const grupos = [[], [], [], [], []];
    const manos = [new THREE.Vector3(), new THREE.Vector3()];
    const nManos = [0, 0];

    for (let t = 0; t < idx.count; t += 3) {
        const i0 = idx.getX(t);
        const i1 = idx.getX(t + 1);
        const i2 = idx.getX(t + 2);

        const cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3 / u;
        const cy = ((pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3 - baseY) / u;
        const cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3 / u;
        const az = Math.abs(cz);

        let g = 0;

        if (cy < 12.3 && az < 7.2) {
            g = cz < 0 ? 1 : 2;

        } else if (
            cy < 22.6 && cy >= 9.5 && az > 3.7 &&
            (cy >= 13.5 || az >= 7.2)
        ) {
            g = cz < 0 ? 3 : 4;

            if (az > 11) {
                const lado = cz < 0 ? 0 : 1;
                manos[lado].add(new THREE.Vector3(cx, cy, cz));
                nManos[lado]++;
            }
        }

        grupos[g].push(i0, i1, i2);
    }

    // Cuerpo: reemplaza a la malla original por un contenedor con su misma pose
    const contenedor = new THREE.Group();
    contenedor.position.copy(malla.position);
    contenedor.quaternion.copy(malla.quaternion);
    contenedor.scale.copy(malla.scale);

    const padre = malla.parent;
    padre.add(contenedor);
    padre.remove(malla);

    const crearMalla = (indices, junta) => {
        const g = geo.clone();
        g.setIndex(indices);

        const m = new THREE.Mesh(g, malla.material);
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;

        if (!junta) {
            contenedor.add(m);
            return null;
        }

        // La malla queda centrada en su articulacion para rotar desde ahi
        g.translate(-junta.x, -junta.y, -junta.z);

        const pivote = new THREE.Group();
        pivote.position.copy(junta);
        pivote.add(m);
        contenedor.add(pivote);

        return pivote;
    };

    crearMalla(grupos[0], null);

    const adelante = new THREE.Vector3(1, 0, 0);   // el robot mira hacia +x

    // [grupo, lado (-1 / +1), esBrazo]
    const extremidades = [
        [1, -1, false],
        [2, 1, false],
        [3, -1, true],
        [4, 1, true]
    ];

    for (const [numero, lado, esBrazo] of extremidades) {
        if (grupos[numero].length === 0) continue;

        // Articulacion: cadera o hombro (en las unidades del modelo)
        const junta = esBrazo
            ? new THREE.Vector3(0, 21.5, lado * 4.5)
            : new THREE.Vector3(0, 12.3, lado * 3.2);

        let eje;

        if (esBrazo) {
            // Eje perpendicular al brazo y a "adelante": el brazo se mueve
            // hacia adelante y atras sin cambiar de largo
            const m = manos[lado < 0 ? 0 : 1];
            const dir = m.clone().divideScalar(Math.max(1, nManos[lado < 0 ? 0 : 1]))
                .sub(junta);

            eje = dir.normalize().cross(adelante).normalize();

        } else {
            // Piernas hacia abajo: eje lateral (z)
            eje = new THREE.Vector3(0, 0, 1);
        }

        const pivote = crearMalla(
            grupos[numero],
            new THREE.Vector3(
                junta.x * u,
                baseY + junta.y * u,
                junta.z * u
            )
        );

        partesRobot.push({
            obj: pivote,
            base: new THREE.Quaternion(),
            eje,
            // piernas alternadas; cada brazo al reves que la pierna de su lado
            signo: esBrazo ? lado : -lado,
            amplitud: esBrazo ? 0.5 : 0.7
        });
    }

    console.log(
        "Robot dividido: piernas y brazos listos (" +
        partesRobot.length + " partes)"
    );

    return true;
}

// Respaldo si el GLB no trae animaciones: pasos, balanceo y saltito
function animarCaminarRobot(moviendo, dt) {
    if (!modeloRobot || mixerAstro) return;

    fuerzaCaminar = THREE.MathUtils.lerp(
        fuerzaCaminar,
        moviendo ? 1 : 0,
        1 - Math.exp(-12 * dt)
    );

    if (moviendo) faseCaminar += dt * 11;

    const seno = Math.sin(faseCaminar);

    for (const p of partesRobot) {
        qTemp.setFromAxisAngle(
            p.eje,
            p.signo * seno * p.amplitud * fuerzaCaminar
        );

        p.obj.quaternion.copy(qTemp).multiply(p.base);
    }

    // Saltito, balanceo y leve inclinacion hacia adelante
    modeloRobot.position.y =
        baseRobotY + Math.abs(seno) * 0.07 * fuerzaCaminar;

    modeloRobot.rotation.z = -0.07 * fuerzaCaminar + seno * 0.02 * fuerzaCaminar;
}

async function cargarPersonaje() {
    try {
        const gltf = await new GLTFLoader().loadAsync(RUTA_PERSONAJE);
        const modelo = gltf.scene;

        // Sin animaciones propias: se separan piernas y brazos para animarlos
        if (gltf.animations.length === 0) {
            dividirRobot(modelo);
        }

        const caja3 = new THREE.Box3().setFromObject(modelo);
        const tam = caja3.getSize(new THREE.Vector3());
        const centro = caja3.getCenter(new THREE.Vector3());

        const escala = ALTO_ASTRO / tam.y;

        modelo.scale.setScalar(escala);
        modelo.position.set(
            -centro.x * escala,
            -caja3.min.y * escala,
            -centro.z * escala
        );

        modelo.traverse(o => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
                o.frustumCulled = false;
            }
        });

        const pivote = new THREE.Group();
        pivote.rotation.y = ROTACION_ASTRO;
        pivote.add(modelo);

        // Se esconden las piezas de cajas y se usa el robot
        for (const hijo of astro.children) {
            hijo.visible = false;
        }

        astro.add(pivote);

        modeloRobot = modelo;
        baseRobotY = modelo.position.y;

        // Animaciones del GLB (si trae)
        const clips = gltf.animations;

        console.log(
            "Animaciones del robot:",
            clips.map(c => c.name)
        );

        if (clips.length > 0) {
            mixerAstro = new THREE.AnimationMixer(modelo);

            const buscar = patron =>
                clips.find(c => patron.test(c.name));

            const clipCaminar =
                buscar(/walk|camin/i) ||
                buscar(/run|corr/i) ||
                clips[0];

            const clipReposo = buscar(/idle|rest|stand|repos|quiet/i);

            accionCaminar = mixerAstro.clipAction(clipCaminar);

            if (clipReposo && clipReposo !== clipCaminar) {
                accionReposo = mixerAstro.clipAction(clipReposo);
            }

            astroMoviendo = null;
            actualizarAnimacionAstro(false);

        } else {
            // Si no se pudo dividir, se buscan piernas/brazos por nombre
            if (partesRobot.length === 0) {
                buscarPartesRobot(modelo);
            }
        }

    } catch (err) {
        console.warn("No se pudo cargar " + RUTA_PERSONAJE, err);
    }
}

function actualizarAnimacionAstro(moviendo) {
    if (!mixerAstro || moviendo === astroMoviendo) return;

    astroMoviendo = moviendo;

    if (moviendo) {
        accionCaminar.paused = false;
        accionCaminar.reset().fadeIn(0.15).play();

        if (accionReposo) accionReposo.fadeOut(0.15);

    } else if (accionReposo) {
        accionReposo.reset().fadeIn(0.15).play();
        accionCaminar.fadeOut(0.15);

    } else {
        // Sin animacion de reposo: se queda congelado en el cuadro actual
        accionCaminar.play();
        accionCaminar.paused = true;
    }
}

async function cargarCarros() {
    const resultados = await Promise.allSettled(
        RUTAS_CARROS.map(ruta => cargarModeloOBJ(ruta))
    );

    resultados.forEach((r, i) => {
        if (r.status === "fulfilled") {
            modelosCarro.push(
                normalizarModelo(r.value, LARGO_CARRO)
            );
        } else {
            console.warn(
                "No se pudo cargar " + RUTAS_CARROS[i],
                r.reason
            );
        }
    });
}

function crearVehiculo(
    grupoTramo, z, x, velocidad, indice
) {
    const grupo = new THREE.Group();

    // Si hay modelos GLB cargados, se usan en vez de las cajas
    if (modelosCarro.length > 0) {
        const base = modelosCarro[indice % modelosCarro.length];
        const carro = base.clone(true);

        // Se orienta segun hacia donde avanza (eje X)
        carro.rotation.y =
            (velocidad > 0 ? Math.PI / 2 : -Math.PI / 2) +
            ROTACION_EXTRA;

        grupo.add(carro);
        grupo.position.set(x, 0, z);
        grupoTramo.add(grupo);

        vehiculos.push({
            mesh: grupo,
            velocidad
        });

        return;
    }

    const colores = [
        0xff527d,
        0x36c7ff,
        0xffc354,
        0x9c6dff
    ];

    const pintura = mat(
        colores[indice % colores.length],
        0.5
    );

    grupo.add(
        caja(
            2.2, 0.55, 0.8,
            pintura,
            0, 0.55, 0
        )
    );

    grupo.add(
        caja(
            1.2, 0.38, 0.65,
            M.oscuro,
            0, 1.0, 0
        )
    );

    for (const lado of [-1, 1]) {
        grupo.add(
            esfera(
                0.17, M.cian,
                lado * 0.85, 0.23, 0.38
            )
        );

        grupo.add(
            esfera(
                0.17, M.cian,
                lado * 0.85, 0.23, -0.38
            )
        );
    }

    grupo.position.set(x, 0, z);
    grupoTramo.add(grupo);

    vehiculos.push({
        mesh: grupo,
        velocidad
    });
}

const CARRILES_POR_CALLE = 3;

function crearCarriles(grupo, zona, tramo) {
    // La calle ocupa de (inicio - 0.5) a (fin + 0.5), repartida en carriles iguales
    const borde = zona[1] - 0.5;
    const filas = zona[2] - zona[1] + 1;
    const ancho = filas / CARRILES_POR_CALLE;

    // Lineas: bordes continuos y divisiones de carril discontinuas
    for (let k = 0; k <= CARRILES_POR_CALLE; k++) {
        const zl = borde + k * ancho;
        const esBorde = k === 0 || k === CARRILES_POR_CALLE;

        if (esBorde) {
            grupo.add(
                caja(
                    44, 0.025, 0.07,
                    M.cian,
                    0, -0.035, zl
                )
            );
            continue;
        }

        for (let x = -21; x <= 21; x += 3) {
            grupo.add(
                caja(
                    1.4, 0.025, 0.07,
                    M.casco,
                    x, -0.035, zl
                )
            );
        }
    }

    // Cada carril tiene su direccion, su velocidad y sus carros
    for (let i = 0; i < CARRILES_POR_CALLE; i++) {
        const zc = borde + (i + 0.5) * ancho;

        const vel =
            (i % 2 === 0 ? 1 : -1) *
            (tramo.carros + (i % 3) * 0.4);

        for (let j = 0; j < 2; j++) {
            crearVehiculo(
                grupo,
                zc,
                -7 + j * 12,
                vel,
                i + j
            );
        }
    }
}

// =====================================================
// 14. PLATAFORMAS GALACTICAS (antes troncos)
// =====================================================

const ANCHO_PLATAFORMA = 0.9;
const GROSOR_PLATAFORMA = 0.22;
const LARGO_TRONCO = 4.2;    // la colision usa este largo (no cambiar)

// Altura de la parte de arriba de la plataforma (donde se para el personaje)
const ALTURA_TRONCO = 0.3;

// Tronco que esta debajo de la posicion (x, z), o null
function buscarTronco(x, z) {
    for (const t of troncos) {
        if (
            Math.abs(x - t.mesh.position.x) < LARGO_TRONCO / 2 - 0.15 &&
            Math.abs(z - t.mesh.position.z) < 0.55
        ) {
            return t;
        }
    }

    return null;
}

// Altura del piso en ese punto: 0 normalmente, o la del tronco en el rio
function alturaSuelo(x, z) {
    if (filasAgua.has(Math.round(z)) && buscarTronco(x, z)) {
        return ALTURA_TRONCO;
    }

    return 0;
}

const MAT_PLATAFORMA = mat(0x1b1f45, 0.75);
const MAT_PLATAFORMA_TOPE = mat(0x2a2f66, 0.6, 0.15);

function crearTronco(grupoTramo, z, x, velocidad) {
    const grupo = new THREE.Group();

    // Cuerpo flotante (la parte de arriba queda en ALTURA_TRONCO)
    grupo.add(
        caja(
            LARGO_TRONCO, GROSOR_PLATAFORMA, ANCHO_PLATAFORMA,
            MAT_PLATAFORMA,
            0, ALTURA_TRONCO - GROSOR_PLATAFORMA / 2, 0
        )
    );

    // Tapa superior ligeramente mas clara
    grupo.add(
        caja(
            LARGO_TRONCO - 0.3, 0.04, ANCHO_PLATAFORMA - 0.2,
            MAT_PLATAFORMA_TOPE,
            0, ALTURA_TRONCO - 0.02, 0
        )
    );

    // Bordes de neon (violeta arriba, cian en los lados cortos)
    for (const lado of [-1, 1]) {
        grupo.add(
            caja(
                LARGO_TRONCO, 0.05, 0.06,
                M.violeta,
                0, ALTURA_TRONCO - 0.02,
                lado * (ANCHO_PLATAFORMA / 2)
            )
        );

        grupo.add(
            caja(
                0.07, 0.05, ANCHO_PLATAFORMA,
                M.cian,
                lado * (LARGO_TRONCO / 2),
                ALTURA_TRONCO - 0.02, 0
            )
        );
    }

    // Luces centrales
    for (const px of [-0.9, 0, 0.9]) {
        grupo.add(
            esfera(
                0.07, M.rosa,
                px, ALTURA_TRONCO + 0.01, 0
            )
        );
    }

    // Propulsores brillantes debajo
    for (const px of [-1.2, 1.2]) {
        const prop = cilindro(
            0.2, 0.1, 0.12,
            M.cian,
            px, ALTURA_TRONCO - GROSOR_PLATAFORMA - 0.04, 0
        );

        grupo.add(prop);
    }

    // Resplandor bajo la plataforma
    grupo.add(
        new THREE.Mesh(
            new THREE.PlaneGeometry(LARGO_TRONCO + 0.8, 1.6),
            new THREE.MeshBasicMaterial({
                map: texturaResplandor,
                color: 0x9c6dff,
                transparent: true,
                opacity: 0.55,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                fog: false,
                toneMapped: false
            })
        )
    );

    const brillo = grupo.children[grupo.children.length - 1];
    brillo.rotation.x = -Math.PI / 2;
    brillo.position.y = -0.03;

    grupo.position.set(x, 0, z);
    grupoTramo.add(grupo);

    troncos.push({
        mesh: grupo,
        velocidad
    });
}

function crearRio(grupo, zona, tramo) {
    const cantidad = 5;
    const separacion = (CONFIG.limiteMoviles * 2) / cantidad;

    for (let z = zona[1]; z <= zona[2]; z++) {
        const fila = z - zona[1];

        const vel =
            (fila % 2 === 0 ? 1 : -1) *
            tramo.troncos;

        // Cada fila desfasada para que siempre haya alguna a mano
        const desfase = (fila * 2.3) % separacion;

        for (let j = 0; j < cantidad; j++) {
            crearTronco(
                grupo,
                z,
                -CONFIG.limiteMoviles + desfase + j * separacion,
                vel
            );
        }
    }
}

// =====================================================
// 15. SIERRAS
// =====================================================

// Textura de la sierra (carpeta img). Se pega en las dos caras del disco.
const texturaSierra = new THREE.TextureLoader().load(
    "img/cortadora.jpg"
);

texturaSierra.colorSpace = THREE.SRGBColorSpace;
texturaSierra.anisotropy = 4;

const MAT_CARA_SIERRA = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texturaSierra,
    roughness: 0.5,
    metalness: 0.3,
    // brillo propio para que se vea en la noche
    emissive: 0xffffff,
    emissiveMap: texturaSierra,
    emissiveIntensity: 0.35
});

const RADIO_SIERRA = 0.85;   // la colision usa ~0.9 (no cambiar)

function crearSierras(grupo, zona) {
    for (let z = zona[1]; z <= zona[2]; z += 2) {
        const s = new THREE.Group();

        // Disco con la imagen en las dos caras (lado: metal; caras: textura)
        const disco = new THREE.Mesh(
            new THREE.CylinderGeometry(
                RADIO_SIERRA, RADIO_SIERRA, 0.18, 48
            ),
            [M.sierra, MAT_CARA_SIERRA, MAT_CARA_SIERRA]
        );

        disco.rotation.x = Math.PI / 2;
        disco.castShadow = true;
        s.add(disco);

        s.position.set(
            z % 4 === 0 ? -3 : 3,
            0.9,
            z
        );

        grupo.add(s);

        sierras.push({
            mesh: s,
            centroX: s.position.x,
            fase: z
        });
    }
}

// =====================================================
// 16. GEMAS Y TROFEO
// =====================================================

// Resplandor: un circulo difuso (centro claro, borde transparente)
function crearTexturaResplandor() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;

    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);

    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.15)");
    grad.addColorStop(1, "rgba(255,255,255,0)");

    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(c);
}

const texturaResplandor = crearTexturaResplandor();

// =====================================================
// GEMAS (imagen img/gema.jpg con resplandor morado)
// =====================================================

const ALTO_GEMA = 1.6;            // tamano de la imagen en el juego
const ALTURA_GEMA = 1.5;          // altura base a la que flota
const COLOR_GEMA = 0x9c3dff;      // resplandor morado

// Mascara circular suave (blanco = visible, negro = transparente).
// La imagen es .jpg, asi que se recorta en circulo en vez de verse cuadrada.
function crearMascaraCircular() {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;

    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);

    grad.addColorStop(0, "#fff");
    grad.addColorStop(0.8, "#fff");
    grad.addColorStop(1, "#000");

    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(c);
}

const mascaraGema = crearMascaraCircular();

// Imagen plana de la gema (carpeta img)
const texturaGema = new THREE.TextureLoader().load(
    "img/gema.jpg",
    tex => {
        tex.colorSpace = THREE.SRGBColorSpace;
    },
    undefined,
    () => console.warn("No se pudo cargar img/gema.jpg")
);

texturaGema.colorSpace = THREE.SRGBColorSpace;

function crearGema(grupo, numero, z) {
    // Base de la plataforma
    grupo.add(
        caja(
            2.7, 0.25, 2.3,
            M.metal,
            0, 0.05, z
        )
    );

    // Imagen plana + resplandor morado (siempre miran a la camara)
    const cristal = new THREE.Group();

    const imagen = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: texturaGema,
            alphaMap: mascaraGema,
            transparent: true,
            fog: false,
            toneMapped: false
        })
    );

    imagen.scale.set(ALTO_GEMA, ALTO_GEMA, 1);

    const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: texturaResplandor,
            color: COLOR_GEMA,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
            toneMapped: false
        })
    );

    halo.scale.set(4.2, 4.2, 1);

    // El halo va detras de la imagen
    halo.renderOrder = 1;
    imagen.renderOrder = 2;

    cristal.add(halo, imagen);
    cristal.position.set(0, ALTURA_GEMA, z);
    grupo.add(cristal);

    // Resplandor morado sobre la plataforma
    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 3.4),
        new THREE.MeshBasicMaterial({
            map: texturaResplandor,
            color: COLOR_GEMA,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
            toneMapped: false
        })
    );

    suelo.rotation.x = -Math.PI / 2;
    suelo.position.set(0, 0.2, z);
    grupo.add(suelo);

    gemas.push({
        numero,
        cristal,
        halo,
        suelo,
        z,
        recogida: false
    });
}

const ALTO_TROFEO = 2.2;       // altura de la imagen del trofeo en el juego
const ALTURA_TROFEO = 1.7;     // a que altura flota
const COLOR_RESPLANDOR = 0xffc75d;

let trofeoSprite = null;
let trofeoHalo = null;

function crearTrofeo(grupo, z) {
    const t = new THREE.Group();

    // Base de la plataforma
    t.add(caja(2.7, 0.25, 2.3, M.metal));

    // Imagen del trofeo (siempre mira a la camara)
    const imagen = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: null,
            transparent: true,
            fog: false,
            toneMapped: false
        })
    );

    imagen.scale.set(ALTO_TROFEO, ALTO_TROFEO, 1);
    imagen.position.set(0, ALTURA_TROFEO, 0);

    new THREE.TextureLoader().load("img/trofeo.png", tex => {
        tex.colorSpace = THREE.SRGBColorSpace;

        imagen.material.map = tex;
        imagen.material.needsUpdate = true;

        // Respeta la proporcion de la imagen
        const proporcion = tex.image.width / tex.image.height;
        imagen.scale.set(ALTO_TROFEO * proporcion, ALTO_TROFEO, 1);
    });

    // Resplandor detras del trofeo
    const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: texturaResplandor,
            color: COLOR_RESPLANDOR,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
            toneMapped: false
        })
    );

    halo.scale.set(4.5, 4.5, 1);
    halo.position.set(0, ALTURA_TROFEO, -0.05);

    // Resplandor sobre la plataforma
    const suelo = new THREE.Mesh(
        new THREE.PlaneGeometry(3.4, 3.4),
        new THREE.MeshBasicMaterial({
            map: texturaResplandor,
            color: COLOR_RESPLANDOR,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
            toneMapped: false
        })
    );

    suelo.rotation.x = -Math.PI / 2;
    suelo.position.y = 0.16;

    t.add(halo, imagen, suelo);

    t.position.set(0, 0, z);
    grupo.add(t);

    trofeo = t;
    trofeoSprite = imagen;
    trofeoHalo = halo;
}

// =====================================================
// 17. CONSTRUCCION PROGRESIVA DEL MAPA
// =====================================================

function construirTramo(tramo) {
    if (tramosCreados.has(tramo.id)) return;

    tramosCreados.add(tramo.id);

    const grupo = new THREE.Group();
    grupo.name = `Sector_${tramo.id + 1}`;

    escena.add(grupo);
    gruposTramo.set(tramo.id, grupo);

    for (const zona of tramo.zonas) {
        const [tipo, inicio, fin] = zona;

        const material =
            tipo === "carretera" ? M.carretera :
            tipo === "agua" ? M.agua :
            tipo === "checkpoint" ? M.plataforma :
            tipo === "sierras" ? M.metal :
            tipo === "trofeo" ? M.plataforma :
            M.pasto;

        for (let z = inicio; z <= fin; z++) {

            // Terreno central
            grupo.add(
                caja(
                    19, 0.2, 1,
                    material,
                    0, -0.15, z
                )
            );

            if (tipo === "agua") {
                filasAgua.add(z);
            }

            // Carreteras y rios abiertos lateralmente
            if (
                tipo === "carretera" ||
                tipo === "agua"
            ) {
                for (const lado of [-1, 1]) {
                    grupo.add(
                        caja(
                            15, 0.2, 1,
                            material,
                            lado * 17,
                            -0.15,
                            z
                        )
                    );
                }
            }

            // Iluminacion de checkpoints
            if (tipo === "checkpoint") {
                for (const x of [-6, 6]) {
                    grupo.add(
                        caja(
                            0.16, 0.05, 1,
                            M.cian,
                            x, -0.02, z
                        )
                    );
                }
            }
        }

        if (tipo === "carretera") {
            crearCarriles(grupo, zona, tramo);
        }

        if (tipo === "agua") {
            crearRio(grupo, zona, tramo);
        }

        if (tipo === "sierras") {
            crearSierras(grupo, zona);
        }
    }

    // Edificios futuristas del nuevo sector
    decorarTramo(grupo, tramo);

    if (tramo.id < 2) {
        crearGema(
            grupo,
            tramo.id + 1,
            tramo.fin - 1
        );
    } else {
        crearTrofeo(grupo, tramo.fin - 1);
    }
}

// =====================================================
// 18. HUD Y PANTALLAS
// =====================================================

const UI = {
    vidas: document.getElementById("vidas"),
    puntos: document.getElementById("puntos"),
    metas: document.getElementById("metas"),
    tiempo: document.getElementById("tiempo"),
    camara: document.getElementById("camaraModo"),
    overlay: document.getElementById("overlay"),
    pausa: document.getElementById("pausa"),
    titulo: document.getElementById("titulo"),
    subtitulo: document.getElementById("subtitulo"),
    mensaje: document.getElementById("mensaje"),
    jugar: document.getElementById("btnJugar"),
    continuar: document.getElementById("btnContinuar")
};

// =====================================================
// 18. HUD Y PANTALLAS (CONTINUACION)
// =====================================================

function actualizarHUD() {
    UI.vidas.textContent = vidas;
    UI.puntos.textContent = puntos;

    // Tres metas: dos estaciones de energia y el trofeo final
    const metasCompletadas =
        gemasRecogidas +
        (estado === ESTADO.VICTORIA ? 1 : 0);

    UI.metas.textContent = `${metasCompletadas}/3`;

    UI.tiempo.textContent = Math.ceil(tiempo);

    UI.camara.textContent =
        modoCamara === 0
            ? "Elevada"
            : "Primera persona";
}

function cambiarEstado(nuevo) {
    estado = nuevo;

    UI.overlay.classList.toggle(
        "hidden",
        ![
            ESTADO.INICIO,
            ESTADO.FIN,
            ESTADO.VICTORIA
        ].includes(estado)
    );

    UI.pausa.classList.toggle(
        "hidden",
        estado !== ESTADO.PAUSA
    );

    actualizarAudioEstado(estado);
}

// =====================================================
// 19. CHECKPOINTS Y REINICIO
// =====================================================

function reaparecer() {
    astro.position.set(0, 0, checkpointZ);
    astro.rotation.y = 0;
    velocidadVertical = 0;
    invulnerable = CONFIG.invulnerabilidad;
}

function limpiarProgreso() {
    for (const grupo of gruposTramo.values()) {
        escena.remove(grupo);
    }

    gruposTramo.clear();
    tramosCreados.clear();
    filasAgua.clear();

    vehiculos.length = 0;
    troncos.length = 0;
    sierras.length = 0;
    gemas.length = 0;

    trofeo = null;
    trofeoSprite = null;
    trofeoHalo = null;

    for (const p of particulas) {
        escena.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
    }

    particulas.length = 0;

    construirTramo(TRAMOS[0]);
}

function reiniciar() {
    vidas = CONFIG.vidas;
    tiempo = CONFIG.tiempo;

    puntos = 0;
    gemasRecogidas = 0;
    tramoActual = 0;
    checkpointZ = 0;
    relojMundo = 0;

    limpiarProgreso();
    reaparecer();

    actualizarHUD();
    cambiarEstado(ESTADO.JUEGO);

    reloj.getDelta();
}

function finalizar(gano, mensaje) {
    cambiarEstado(
        gano ? ESTADO.VICTORIA : ESTADO.FIN
    );

    UI.titulo.textContent =
        gano ? "MISION COMPLETADA" : "GAME OVER";

    UI.subtitulo.textContent =
        gano ? "ASTRO & BOLT" : "MISION FALLIDA";

    UI.mensaje.textContent = mensaje;
    UI.jugar.textContent = "REINICIAR MISION";

    actualizarHUD();
}

function perderVida() {
    if (
        estado !== ESTADO.JUEGO ||
        invulnerable > 0
    ) {
        return;
    }

    vidas--;

    reproducirSfx(SONIDOS.muerte);
    crearParticulas(astro.position, 0xff496f);

    if (vidas <= 0) {
        finalizar(
            false,
            "Astro se quedo sin vidas."
        );
    } else {
        reaparecer();
    }

    actualizarHUD();
}

function recogerGema(gema) {
    if (
        gema.recogida ||
        gema.numero !== gemasRecogidas + 1
    ) {
        return;
    }

    gema.recogida = true;
    gema.cristal.visible = false;
    gema.suelo.visible = false;

    gemasRecogidas++;
    puntos += 100;

    checkpointZ = gema.z;

    crearParticulas(
        new THREE.Vector3(0, 0, gema.z),
        0x9c3dff
    );

    sonido(750, 0.25);

    tramoActual = gemasRecogidas;

    construirTramo(TRAMOS[tramoActual]);
    actualizarHUD();
}

// =====================================================
// 20. CONTROLES
// =====================================================

window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();

    if (
        [
            "arrowup",
            "arrowdown",
            "arrowleft",
            "arrowright",
            " ",
            "tab"
        ].includes(k)
    ) {
        e.preventDefault();
    }

    if (k === "tab") {
        if (!e.repeat) {
            modoCamara = 1 - modoCamara;
            actualizarHUD();
        }
        return;
    }

    teclas[k] = true;

    if (
        (k === "p" || k === "escape") &&
        !e.repeat
    ) {
        if (estado === ESTADO.JUEGO) {
            cambiarEstado(ESTADO.PAUSA);
        } else if (estado === ESTADO.PAUSA) {
            cambiarEstado(ESTADO.JUEGO);
            reloj.getDelta();
        }
    }

    if (
        k === " " &&
        !e.repeat &&
        estado === ESTADO.JUEGO &&
        astro.position.y <= alturaSuelo(
            astro.position.x,
            astro.position.z
        ) + 0.01
    ) {
        velocidadVertical = CONFIG.salto;
        reproducirSfx(SONIDOS.salto);
    }
});

window.addEventListener("keyup", e => {
    teclas[e.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
    Object.keys(teclas).forEach(k => {
        teclas[k] = false;
    });

    if (estado === ESTADO.JUEGO) {
        cambiarEstado(ESTADO.PAUSA);
    }
});

UI.jugar.addEventListener("click", reiniciar);

UI.continuar.addEventListener("click", () => {
    cambiarEstado(ESTADO.JUEGO);
    reloj.getDelta();
});

// =====================================================
// 21. SONIDOS Y MUSICA
// =====================================================

const SONIDOS = {
    muerte: new Audio("sonidos/death.mp3"),
    gameOver: new Audio("sonidos/gameover.mp3"),
    ganaste: new Audio("sonidos/ganaste.mp3"),
    salto: new Audio("sonidos/jump.mp3"),
    menu: new Audio("sonidos/menu.mp3"),
    fondo: new Audio("sonidos/fondo.mp3"),
    pausa: new Audio("sonidos/pausa.mp3")
};

SONIDOS.menu.loop = true;
SONIDOS.fondo.loop = true;
SONIDOS.pausa.loop = true;

SONIDOS.menu.volume = 0.45;
SONIDOS.fondo.volume = 0.4;
SONIDOS.pausa.volume = 0.35;
SONIDOS.ganaste.volume = 0.55;
SONIDOS.gameOver.volume = 0.6;
SONIDOS.muerte.volume = 0.7;
SONIDOS.salto.volume = 0.5;

let musicaActiva = null;

function detenerMusica() {
    [
        SONIDOS.menu,
        SONIDOS.fondo,
        SONIDOS.pausa,
        SONIDOS.ganaste,
        SONIDOS.gameOver
    ].forEach(a => {
        a.pause();
        a.currentTime = 0;
    });

    musicaActiva = null;
}

function reproducirSfx(audio) {
    try {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    } catch (err) {
        console.warn("Audio no disponible", err);
    }
}

function actualizarAudioEstado(nuevoEstado) {
    if (nuevoEstado === ESTADO.PAUSA) {
        SONIDOS.fondo.pause();

        musicaActiva = SONIDOS.pausa;
        SONIDOS.pausa.currentTime = 0;
        SONIDOS.pausa.play().catch(() => {});
        return;
    }

    if (
        nuevoEstado === ESTADO.JUEGO &&
        !SONIDOS.fondo.paused
    ) {
        return;
    }

    if (
        nuevoEstado === ESTADO.JUEGO &&
        SONIDOS.fondo.currentTime > 0 &&
        musicaActiva === SONIDOS.pausa
    ) {
        SONIDOS.pausa.pause();
        SONIDOS.pausa.currentTime = 0;

        musicaActiva = SONIDOS.fondo;
        SONIDOS.fondo.play().catch(() => {});
        return;
    }

    detenerMusica();

    if (nuevoEstado === ESTADO.INICIO) {
        musicaActiva = SONIDOS.menu;
        SONIDOS.menu.play().catch(() => {});

    } else if (nuevoEstado === ESTADO.JUEGO) {
        musicaActiva = SONIDOS.fondo;
        SONIDOS.fondo.play().catch(() => {});

    } else if (nuevoEstado === ESTADO.FIN) {
        musicaActiva = SONIDOS.gameOver;
        SONIDOS.gameOver.play().catch(() => {});

    } else if (nuevoEstado === ESTADO.VICTORIA) {
        musicaActiva = SONIDOS.ganaste;
        SONIDOS.ganaste.play().catch(() => {});
    }
}

// =====================================================
// DESBLOQUEO DE AUDIO POR INTERACCION
// =====================================================

function desbloquearAudio() {
    if (musicaActiva && musicaActiva.paused) {
        musicaActiva.play().catch(() => {});
    }

    window.removeEventListener(
        "pointerdown",
        desbloquearAudio
    );

    window.removeEventListener(
        "keydown",
        desbloquearAudio
    );
}

window.addEventListener(
    "pointerdown",
    desbloquearAudio
);

window.addEventListener(
    "keydown",
    desbloquearAudio
);

// =====================================================
// EFECTOS DE SONIDO GENERADOS
// =====================================================

let audioCtx = null;

function sonido(frecuencia, duracion) {
    try {
        if (!audioCtx) {
            audioCtx = new (
                window.AudioContext ||
                window.webkitAudioContext
            )();
        }

        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t = audioCtx.currentTime;

        osc.type = "triangle";

        osc.frequency.setValueAtTime(
            frecuencia,
            t
        );

        gain.gain.setValueAtTime(0.08, t);

        gain.gain.exponentialRampToValueAtTime(
            0.001,
            t + duracion
        );

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(t);
        osc.stop(t + duracion);

    } catch (err) {
        console.warn("Audio no disponible", err);
    }
}

// =====================================================
// 22. PARTICULAS
// =====================================================

function crearParticulas(pos, color) {
    for (let i = 0; i < 12; i++) {
        const p = esfera(
            0.09,
            new THREE.MeshBasicMaterial({ color }),
            pos.x,
            pos.y + 1,
            pos.z
        );

        escena.add(p);

        particulas.push({
            mesh: p,
            vida: 0.65,
            velocidad: new THREE.Vector3(
                (Math.random() - 0.5) * 5,
                Math.random() * 4,
                (Math.random() - 0.5) * 5
            )
        });
    }
}

function actualizarParticulas(dt) {
    for (
        let i = particulas.length - 1;
        i >= 0;
        i--
    ) {
        const p = particulas[i];

        p.vida -= dt;

        p.mesh.position.addScaledVector(
            p.velocidad,
            dt
        );

        p.velocidad.y -= 9 * dt;

        if (p.vida <= 0) {
            escena.remove(p.mesh);
            p.mesh.geometry.dispose();
            p.mesh.material.dispose();
            particulas.splice(i, 1);
        }
    }
}

// =====================================================
// 23. MOVIMIENTO DEL JUGADOR
// =====================================================

function actualizarJugador(dt) {
    let dx = 0;
    let dz = 0;

    // Controles del jugador
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

        // El personaje gira hacia donde camina (W = al frente, A/D = a los lados)
        // El personaje NO gira con las teclas: siempre mira al frente
        astro.rotation.y = 0;

        // Animacion de brazos y piernas
        const paso =
            Math.sin(relojMundo * 12) * 0.4;

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

    // Animacion del robot (si tiene)
    actualizarAnimacionAstro(longitud > 0);

    if (mixerAstro) {
        mixerAstro.update(dt);
    }

    animarCaminarRobot(longitud > 0, dt);

    // Gravedad y salto (el suelo sube si hay una plataforma debajo)
    const suelo = alturaSuelo(
        astro.position.x,
        astro.position.z
    );

    // Si camina hacia un tronco, se sube encima
    if (astro.position.y < suelo) {
        astro.position.y = suelo;

        if (velocidadVertical < 0) {
            velocidadVertical = 0;
        }
    }

    if (
        astro.position.y > suelo ||
        velocidadVertical > 0
    ) {
        velocidadVertical -= CONFIG.gravedad * dt;
        astro.position.y += velocidadVertical * dt;

        if (astro.position.y < suelo) {
            astro.position.y = suelo;
            velocidadVertical = 0;
        }
    }

    // Limites del escenario
    astro.position.x = THREE.MathUtils.clamp(
        astro.position.x,
        -CONFIG.limiteX,
        CONFIG.limiteX
    );

    astro.position.z = THREE.MathUtils.clamp(
        astro.position.z,
        0,
        TRAMOS[tramoActual].fin
    );

    // Invulnerabilidad temporal al reaparecer
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
// 24. MOVIMIENTO DE OBSTACULOS
// =====================================================

function actualizarMoviles(dt) {

    // Vehiculos y troncos
    for (const lista of [vehiculos, troncos]) {
        for (const obj of lista) {
            obj.mesh.position.x +=
                obj.velocidad * dt;

            // Reciclar objetos al salir del mapa
            if (
                obj.mesh.position.x >
                CONFIG.limiteMoviles
            ) {
                obj.mesh.position.x =
                    -CONFIG.limiteMoviles;
            }

            if (
                obj.mesh.position.x <
                -CONFIG.limiteMoviles
            ) {
                obj.mesh.position.x =
                    CONFIG.limiteMoviles;
            }
        }
    }

    // Sierras giratorias y movimiento lateral
    for (const s of sierras) {
        s.mesh.rotation.z += dt * 8;

        s.mesh.position.x =
            s.centroX +
            Math.sin(
                relojMundo * 1.5 + s.fase
            ) * 3;
    }
}

// =====================================================
// 25. COLISIONES
// =====================================================

function comprobarColisiones(dt) {
    const x = astro.position.x;
    const z = astro.position.z;

    // -----------------------------------------------
    // COLISIONES CON VEHICULOS
    // -----------------------------------------------

    if (astro.position.y < 0.65) {
        for (const v of vehiculos) {
            if (
                Math.abs(
                    x - v.mesh.position.x
                ) < 1.4 &&
                Math.abs(
                    z - v.mesh.position.z
                ) < 0.7
            ) {
                perderVida();
                return;
            }
        }
    }

    // -----------------------------------------------
    // COLISIONES CON SIERRAS
    // -----------------------------------------------

    if (astro.position.y < 1.5) {
        for (const s of sierras) {
            if (
                Math.abs(
                    x - s.mesh.position.x
                ) < 0.9 &&
                Math.abs(
                    z - s.mesh.position.z
                ) < 0.9
            ) {
                perderVida();
                return;
            }
        }
    }

    // -----------------------------------------------
    // RIO Y TRONCOS
    // -----------------------------------------------

    if (filasAgua.has(Math.round(z))) {
        const soporte = buscarTronco(x, z);

        // Astro se desplaza junto al tronco
        if (
            soporte &&
            astro.position.y < ALTURA_TRONCO + 0.15
        ) {
            astro.position.x +=
                soporte.velocidad * dt;

            astro.position.x = THREE.MathUtils.clamp(
                astro.position.x,
                -CONFIG.limiteX,
                CONFIG.limiteX
            );
        }

        // Pierde una vida si cae al agua
        if (
            !soporte &&
            astro.position.y < 0.15
        ) {
            perderVida();
            return;
        }
    }

    // -----------------------------------------------
    // META 1 Y META 2: GEMAS
    // -----------------------------------------------

    for (const gema of gemas) {
        if (
            !gema.recogida &&
            Math.hypot(x, z - gema.z) < 1.1
        ) {
            recogerGema(gema);
            return;
        }
    }

    // -----------------------------------------------
    // META 3: TROFEO FINAL
    // -----------------------------------------------

    if (
        trofeo &&
        gemasRecogidas === 2 &&
        Math.hypot(
            x - trofeo.position.x,
            z - trofeo.position.z
        ) < 1.3
    ) {
        puntos += 300;

        finalizar(
            true,
            "Completaste las tres metas: dos gemas y el trofeo final."
        );

        return;
    }
}

// =====================================================
// 26. CAMARAS
// =====================================================

const posCamara = new THREE.Vector3();
const mirar = new THREE.Vector3();
const mirarSuave = new THREE.Vector3(0, 1, 5);

let fovActual = 70;

function actualizarCamara(dt) {
    if (modoCamara === 0) {
        posCamara.set(
            astro.position.x,
            astro.position.y + 7,
            astro.position.z - 9
        );

        mirar.set(
            astro.position.x,
            astro.position.y + 1,
            astro.position.z + 8
        );

    } else {
        posCamara.set(
            astro.position.x,
            astro.position.y + 1.7,
            astro.position.z + 0.15
        );

        mirar.set(
            astro.position.x,
            astro.position.y + 1.7,
            astro.position.z + 12
        );
    }

    const t =
        1 - Math.exp(-CONFIG.velocidadCamara * dt);

    camara.position.lerp(posCamara, t);
    mirarSuave.lerp(mirar, t);

    camara.lookAt(mirarSuave);

    const fov = THREE.MathUtils.lerp(
        fovActual,
        modoCamara === 0 ? 70 : 80,
        t
    );

    if (Math.abs(fov - fovActual) > 0.001) {
        fovActual = fov;
        camara.fov = fov;
        camara.updateProjectionMatrix();
    }

    // El cielo acompana al jugador
    cielo.position.set(
        astro.position.x,
        0,
        astro.position.z
    );
}

// =====================================================
// 27. ANIMACION DEL ESCENARIO
// =====================================================

function actualizarDecoracion(dt) {
    bolt.position.lerp(
        new THREE.Vector3(
            astro.position.x + 1,
            astro.position.y + 1.8 +
                Math.sin(relojMundo * 3) * 0.15,
            astro.position.z - 0.6
        ),
        1 - Math.exp(-5 * dt)
    );

    // El drone no gira: mira al frente igual que Astro
    bolt.rotation.y = 0;
    bolt.visible = modoCamara === 0;

    if (mixerDrone) {
        mixerDrone.update(dt);
    }

    for (const h of helicesDrone) {
        h.rotation.y += dt * 40;
    }

    planetaGrande.rotation.y += dt * 0.01;

    for (const gema of gemas) {
        if (!gema.recogida) {
            // Flota subiendo y bajando
            gema.cristal.position.y =
                ALTURA_GEMA +
                Math.sin(relojMundo * 2.2) * 0.25;

            // El resplandor morado late
            const tam = 4 + Math.sin(relojMundo * 3) * 0.4;
            gema.halo.scale.set(tam, tam, 1);
        }
    }

    // El trofeo flota y su resplandor late
    if (trofeo && trofeoSprite && trofeoHalo) {
        const pulso = Math.sin(relojMundo * 2.5);

        trofeoSprite.position.y =
            ALTURA_TROFEO + Math.sin(relojMundo * 2.2) * 0.25;

        trofeoHalo.position.y = trofeoSprite.position.y;

        const tam = 4.5 + pulso * 0.5;
        trofeoHalo.scale.set(tam, tam, 1);
        trofeoHalo.material.opacity = 0.75 + pulso * 0.2;
    }
}

// =====================================================
// 28. BUCLE PRINCIPAL
// =====================================================

function animar() {
    requestAnimationFrame(animar);

    const dt = Math.min(
        reloj.getDelta(),
        0.05
    );

    if (estado === ESTADO.JUEGO) {
        relojMundo += dt;
        tiempo -= dt;

        if (tiempo <= 0) {
            tiempo = 0;

            finalizar(
                false,
                "Se termino el tiempo disponible."
            );

        } else {
            actualizarJugador(dt);
            actualizarMoviles(dt);
            comprobarColisiones(dt);
            actualizarNaves(dt);
            actualizarDecoracion(dt);
            actualizarParticulas(dt);
        }

        actualizarHUD();
    }

    actualizarCamara(dt);
    renderer.render(escena, camara);
}

// =====================================================
// 29. INICIALIZACION
// =====================================================

// Primero se cargan los carros GLB y luego se arma el mapa
Promise.all([
    cargarCarros(),
    cargarFarola(),
    cargarPersonaje(),
    cargarDrone()
]).finally(() => {
    limpiarProgreso();
    actualizarHUD();
});

construirTramo(TRAMOS[0]);
actualizarHUD();
actualizarAudioEstado(ESTADO.INICIO);
animar();

// =====================================================
// 30. AJUSTE DE PANTALLA
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