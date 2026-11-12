import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";

// ============================================================
// 1. CONFIGURACION GENERAL
// ============================================================

const CONFIG = {
    vidas: 3,
    tiempo: 240,
    velocidadJugador: 6,
    velocidadSalto: 7,
    gravedad: 18,
    limiteJugadorX: 8,
    anchoCarretera: 44,
    limiteVehiculos: 25,
    invulnerabilidad: 1.5,
    velocidadCamara: 7
};

const ESTADO = {
    INICIO: "inicio",
    JUGANDO: "jugando",
    PAUSA: "pausa",
    DERROTA: "derrota",
    VICTORIA: "victoria"
};

let estado = ESTADO.INICIO;
let vidas = CONFIG.vidas;
let puntos = 0;
let gemas = 0;
let tiempo = CONFIG.tiempo;
let etapaActual = 0;
let modoCamara = 0;
let invulnerable = 0;
let velocidadVertical = 0;
let enSuelo = true;
let ultimoTiempo = 0;
let tiempoGlobal = 0;
let checkpoint = new THREE.Vector3(0, 0, 0);

const teclas = {};
const vehiculos = [];
const troncos = [];
const sierras = [];
const gemasObjetos = [];
const decoraciones = [];
const naves = [];
const particulas = [];
const zonasAgua = [];
const zonasCarretera = [];
const modelos = {};

const loader = new GLTFLoader();

// ============================================================
// 2. ELEMENTOS HTML
// ============================================================

const contenedor =
    document.getElementById("game-container") ||
    document.body;

const hud = {
    vidas: document.getElementById("vidas"),
    puntos: document.getElementById("puntos"),
    metas: document.getElementById("metas"),
    tiempo: document.getElementById("tiempo"),
    camara: document.getElementById("camaraModo")
};

const overlay = document.getElementById("overlay");
const titulo = document.getElementById("titulo");
const subtitulo = document.getElementById("subtitulo");
const mensaje = document.getElementById("mensaje");
const btnJugar = document.getElementById("btnJugar");
const pausaPanel = document.getElementById("pausa");
const btnContinuar = document.getElementById("btnContinuar");

function actualizarHUD() {
    if (hud.vidas) hud.vidas.textContent = vidas;
    if (hud.puntos) hud.puntos.textContent = puntos;
    if (hud.metas) hud.metas.textContent = `${gemas}/2`;
    if (hud.tiempo) hud.tiempo.textContent = Math.ceil(tiempo);
    if (hud.camara) {
        hud.camara.textContent =
            modoCamara === 0 ? "Elevada" : "Primera persona";
    }
}

function mostrarOverlay(t, s, m, boton = "Jugar") {
    if (titulo) titulo.textContent = t;
    if (subtitulo) subtitulo.textContent = s;
    if (mensaje) mensaje.textContent = m;
    if (btnJugar) btnJugar.textContent = boton;
    if (overlay) overlay.style.display = "flex";
}

function ocultarOverlay() {
    if (overlay) overlay.style.display = "none";
}

// ============================================================
// 3. ESCENA THREE.JS
// ============================================================

const escena = new THREE.Scene();
escena.background = new THREE.Color(0x08051c);
escena.fog = new THREE.FogExp2(0x110b32, 0.007);

const camara = new THREE.PerspectiveCamera(
    70,
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

const luzAmbiente = new THREE.HemisphereLight(
    0x8b8dff,
    0x111025,
    2.0
);
escena.add(luzAmbiente);

const luzPrincipal = new THREE.DirectionalLight(
    0xbfcaff,
    2.2
);
luzPrincipal.position.set(-15, 35, 25);
luzPrincipal.castShadow = true;
luzPrincipal.shadow.mapSize.set(2048, 2048);
luzPrincipal.shadow.camera.left = -50;
luzPrincipal.shadow.camera.right = 50;
luzPrincipal.shadow.camera.top = 80;
luzPrincipal.shadow.camera.bottom = -80;
escena.add(luzPrincipal);

// ============================================================
// 4. MATERIALES
// ============================================================

const MAT = {
    suelo: new THREE.MeshStandardMaterial({
        color: 0x172344,
        roughness: 0.85
    }),
    carretera: new THREE.MeshStandardMaterial({
        color: 0x151522,
        roughness: 0.75
    }),
    agua: new THREE.MeshStandardMaterial({
        color: 0x0875b4,
        metalness: 0.55,
        roughness: 0.2
    }),
    borde: new THREE.MeshStandardMaterial({
        color: 0x253154,
        metalness: 0.5
    }),
    neonAzul: new THREE.MeshStandardMaterial({
        color: 0x00cfff,
        emissive: 0x00aaff,
        emissiveIntensity: 2
    }),
    neonRosa: new THREE.MeshStandardMaterial({
        color: 0xff4bd8,
        emissive: 0xff00b7,
        emissiveIntensity: 2
    }),
    neonAmarillo: new THREE.MeshStandardMaterial({
        color: 0xffe781,
        emissive: 0xffc300,
        emissiveIntensity: 1.3
    }),
    madera: new THREE.MeshStandardMaterial({
        color: 0x805333,
        roughness: 0.9
    }),
    metal: new THREE.MeshStandardMaterial({
        color: 0x65718c,
        metalness: 0.8,
        roughness: 0.3
    })
};

function caja(ancho, alto, fondo, material, x, y, z, padre = escena) {
    const objeto = new THREE.Mesh(
        new THREE.BoxGeometry(ancho, alto, fondo),
        material
    );
    objeto.position.set(x, y, z);
    objeto.castShadow = true;
    objeto.receiveShadow = true;
    padre.add(objeto);
    return objeto;
}

function esfera(radio, material, x, y, z, padre = escena) {
    const objeto = new THREE.Mesh(
        new THREE.SphereGeometry(radio, 16, 12),
        material
    );
    objeto.position.set(x, y, z);
    objeto.castShadow = true;
    padre.add(objeto);
    return objeto;
}

// ============================================================
// 5. CARGA DE MODELOS GLB
// ============================================================

const RUTAS = {
    carretera: "./modelos/road_tile.glb",
    farola: "./modelos/street_lamp.glb",
    senal: "./modelos/sign_tall.glb",
    comida: "./modelos/noodle_cart.glb",
    maquina: "./modelos/vending_machine.glb"
};

async function cargarModelo(nombre, ruta) {
    try {
        const gltf = await loader.loadAsync(ruta);
        modelos[nombre] = gltf.scene;

        gltf.scene.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;
            }
        });

        console.log("Modelo cargado:", nombre);
    } catch (error) {
        modelos[nombre] = null;
        console.warn("No se pudo cargar:", ruta, error);
    }
}

async function cargarModelos() {
    await Promise.all(
        Object.entries(RUTAS).map(([nombre, ruta]) =>
            cargarModelo(nombre, ruta)
        )
    );
}

// Centra un modelo y ajusta su tamaño de manera uniforme.
// Esto evita depender de las unidades originales del GLB.

function colocarModelo(nombre, x, y, z, anchoDeseado, altoMaximo = null) {
    if (!modelos[nombre]) return null;

    const grupo = new THREE.Group();
    const copia = modelos[nombre].clone(true);

    grupo.add(copia);
    escena.add(grupo);

    copia.updateMatrixWorld(true);

    const limites = new THREE.Box3().setFromObject(copia);
    const dimensiones = limites.getSize(new THREE.Vector3());

    if (dimensiones.x < 0.0001 ||
        dimensiones.y < 0.0001 ||
        dimensiones.z < 0.0001) {
        escena.remove(grupo);
        return null;
    }

    const horizontal = Math.max(dimensiones.x, dimensiones.z);

    let escala = anchoDeseado / horizontal;

    if (altoMaximo !== null) {
        escala = Math.min(
            escala,
            altoMaximo / dimensiones.y
        );
    }

    copia.scale.setScalar(escala);
    copia.updateMatrixWorld(true);

    const cajaFinal = new THREE.Box3().setFromObject(copia);
    const centro = cajaFinal.getCenter(new THREE.Vector3());

    copia.position.x -= centro.x;
    copia.position.z -= centro.z;
    copia.position.y -= cajaFinal.min.y;

    grupo.position.set(x, y, z);

    return grupo;
}

// ============================================================
// 6. GALAXIA Y ESTRELLAS
// ============================================================

function crearGalaxia() {
    const cantidad = 1600;
    const posiciones = [];

    for (let i = 0; i < cantidad; i++) {
        const angulo = Math.random() * Math.PI * 2;
        const radio = 90 + Math.random() * 170;
        const altura = 20 + Math.random() * 140;

        posiciones.push(
            Math.cos(angulo) * radio,
            altura,
            Math.sin(angulo) * radio + 35
        );
    }

    const geometria = new THREE.BufferGeometry();

    geometria.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(posiciones, 3)
    );

    const estrellas = new THREE.Points(
        geometria,
        new THREE.PointsMaterial({
            color: 0xdacbff,
            size: 0.8,
            sizeAttenuation: true
        })
    );

    escena.add(estrellas);

    const planeta = new THREE.Mesh(
        new THREE.SphereGeometry(18, 32, 24),
        new THREE.MeshStandardMaterial({
            color: 0x6742b8,
            emissive: 0x29105b,
            emissiveIntensity: 1,
            roughness: 0.85
        })
    );

    planeta.position.set(-100, 65, 135);
    escena.add(planeta);

    const anillo = new THREE.Mesh(
        new THREE.TorusGeometry(24, 1.4, 8, 80),
        MAT.neonAzul
    );

    anillo.position.copy(planeta.position);
    anillo.rotation.x = 1.1;
    escena.add(anillo);
}

// ============================================================
// 7. NAVES VOLADORAS
// ============================================================

function crearNave(x, y, z, velocidad) {
    const grupo = new THREE.Group();

    const cuerpo = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 3.5, 4),
        MAT.metal
    );
    cuerpo.rotation.x = Math.PI / 2;
    grupo.add(cuerpo);

    caja(4, 0.15, 0.8, MAT.neonAzul, 0, 0, 0, grupo);
    caja(1.5, 0.15, 1.3, MAT.neonRosa, 0, 0.2, 0, grupo);

    grupo.position.set(x, y, z);
    escena.add(grupo);

    naves.push({
        grupo,
        velocidad,
        origenY: y,
        fase: Math.random() * Math.PI * 2
    });
}

function crearTraficoAereo() {
    for (let i = 0; i < 9; i++) {
        crearNave(
            -75 + Math.random() * 150,
            18 + Math.random() * 25,
            Math.random() * 100,
            4 + Math.random() * 8
        );
    }
}

// ============================================================
// 8. SUELO Y CARRETERAS
// ============================================================

function crearSuelo(zInicio, zFinal) {
    const longitud = zFinal - zInicio;

    caja(
        65,
        0.3,
        longitud,
        MAT.suelo,
        0,
        -0.3,
        (zInicio + zFinal) / 2
    );
}

function crearCarretera(zInicio, zFinal, velocidad = 4) {
    zonasCarretera.push({
        inicio: zInicio,
        final: zFinal,
        velocidad
    });

    const largo = zFinal - zInicio;
    const centroZ = (zInicio + zFinal) / 2;

    // La carretera atraviesa el escenario completo.
    // Los carros se reciclan fuera de la zona visible.

    caja(
        CONFIG.anchoCarretera,
        0.12,
        largo,
        MAT.carretera,
        0,
        0.02,
        centroZ
    );

    // Bordes luminosos en las entradas de cada tramo.

    for (const z of [zInicio + 0.15, zFinal - 0.15]) {
        caja(
            CONFIG.anchoCarretera,
            0.035,
            0.09,
            MAT.neonAzul,
            0,
            0.12,
            z
        );
    }

    // Marcas de carril a lo ancho de la avenida.

    for (let z = zInicio + 1.5; z < zFinal - 0.5; z += 2) {
        for (let x = -20; x <= 20; x += 4) {
            caja(
                1.5,
                0.025,
                0.06,
                MAT.neonAmarillo,
                x,
                0.105,
                z
            );
        }
    }

    // Decoracion exclusivamente en zonas seguras
    // antes y despues de la carretera.

    decorarZonaSegura(zInicio - 1.2);
    decorarZonaSegura(zFinal + 1.2);

    // Carriles activos, dejando espacios entre ellos.

    for (let z = zInicio + 1.2; z < zFinal - 0.5; z += 2.2) {
        const direccion =
            Math.floor((z - zInicio) / 2.2) % 2 === 0 ? 1 : -1;

        crearVehiculo(
            -10 + Math.random() * 8,
            z,
            velocidad * direccion
        );

        crearVehiculo(
            8 + Math.random() * 8,
            z,
            velocidad * direccion
        );
    }
}

function decorarZonaSegura(z) {
    // Las farolas se ubican lejos de la trayectoria
    // de los carros y no bloquean al jugador.

    for (const x of [-12, 12]) {
        const farola = colocarModelo(
            "farola",
            x,
            0,
            z,
            1.2,
            5
        );

        if (!farola) {
            caja(0.15, 3.5, 0.15, MAT.metal, x, 1.75, z);
            esfera(0.3, MAT.neonAzul, x, 3.5, z);
        }
    }
}

// ============================================================
// 9. AGUA Y TRONCOS
// ============================================================

function crearRio(zInicio, zFinal, velocidad = 2) {
    zonasAgua.push({
        inicio: zInicio,
        final: zFinal
    });

    const largo = zFinal - zInicio;

    caja(
        20,
        0.1,
        largo,
        MAT.agua,
        0,
        -0.06,
        (zInicio + zFinal) / 2
    );

    // Los laterales del rio son plataformas decorativas.

    for (const x of [-12, 12]) {
        caja(
            4,
            0.3,
            largo,
            MAT.borde,
            x,
            0,
            (zInicio + zFinal) / 2
        );
    }

    for (let z = zInicio + 1; z < zFinal; z += 1.8) {
        const direccion =
            Math.floor(z - zInicio) % 2 === 0 ? 1 : -1;

        crearTronco(
            -5 + Math.random() * 10,
            z,
            velocidad * direccion
        );

        crearTronco(
            6 + Math.random() * 5,
            z,
            velocidad * direccion
        );
    }
}

function crearTronco(x, z, velocidad) {
    const grupo = new THREE.Group();

    const cilindro = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 4.8, 10),
        MAT.madera
    );

    cilindro.rotation.z = Math.PI / 2;
    cilindro.position.y = 0.2;
    grupo.add(cilindro);

    grupo.position.set(x, 0, z);
    escena.add(grupo);

    troncos.push({
        grupo,
        velocidad,
        activo: true
    });
}

// ============================================================
// 10. VEHICULOS FUTURISTAS PROVISIONALES
// ============================================================

function crearVehiculo(x, z, velocidad) {
    const grupo = new THREE.Group();

    const materialCarro = new THREE.MeshStandardMaterial({
        color: Math.random() > 0.5 ? 0x27346e : 0x642b80,
        metalness: 0.8,
        roughness: 0.25
    });

    caja(2.6, 0.45, 1.1, materialCarro, 0, 0.55, 0, grupo);
    caja(1.5, 0.4, 0.85, MAT.metal, 0, 0.9, 0, grupo);

    // Propulsores luminosos en lugar de ruedas.

    for (const lado of [-1, 1]) {
        caja(
            0.5,
            0.16,
            1.2,
            MAT.neonAzul,
            lado * 1.1,
            0.3,
            0,
            grupo
        );
    }

    caja(0.1, 0.15, 0.8, MAT.neonRosa, -1.35, 0.55, 0, grupo);
    caja(0.1, 0.15, 0.8, MAT.neonAmarillo, 1.35, 0.55, 0, grupo);

    grupo.position.set(x, 0, z);

    escena.add(grupo);

    vehiculos.push({
        grupo,
        velocidad,
        activo: true
    });
}

// ============================================================
// 11. DECORACION CYBERPUNK
// ============================================================

function crearDecoracion(z, tipo) {
    let modelo = null;

    if (tipo === "senal") {
        modelo = colocarModelo("senal", -11, 0, z, 2, 6);
    }

    if (tipo === "comida") {
        modelo = colocarModelo("comida", -14, 0, z, 3.5, 4);
    }

    if (tipo === "maquina") {
        modelo = colocarModelo("maquina", 14, 0, z, 2, 3);
    }

    if (modelo) decoraciones.push(modelo);
}

function crearEdificioProvisional(x, z, ancho, alto) {
    // Se colocan muy lejos del recorrido de los carros.
    // Posteriormente se reemplazaran por modelos GLB.

    const grupo = new THREE.Group();

    const edificio = caja(
        ancho,
        alto,
        ancho,
        new THREE.MeshStandardMaterial({
            color: 0x10172f,
            metalness: 0.45,
            roughness: 0.55
        }),
        0,
        alto / 2,
        0,
        grupo
    );

    edificio.castShadow = false;

    for (let y = 2; y < alto; y += 3) {
        caja(
            ancho + 0.12,
            0.07,
            ancho + 0.12,
            Math.random() > 0.5 ?
                MAT.neonAzul : MAT.neonRosa,
            0,
            y,
            0,
            grupo
        );
    }

    grupo.position.set(x, 0, z);
    escena.add(grupo);
    decoraciones.push(grupo);
}

function crearCiudadLejana() {
    // No hay edificios junto a las salidas de las carreteras.
    // Se ubican en una franja lejana de fondo.

    for (let i = 0; i < 16; i++) {
        const x = i % 2 === 0 ?
            -48 - Math.random() * 20 :
            48 + Math.random() * 20;

        const z = -10 + i * 7;
        const alto = 7 + Math.random() * 16;

        crearEdificioProvisional(
            x,
            z,
            4 + Math.random() * 3,
            alto
        );
    }
}

// ============================================================
// 12. PERSONAJE PROVISIONAL ASTRO
// ============================================================

const astro = new THREE.Group();

const cuerpoAstro = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.75, 6, 12),
    new THREE.MeshStandardMaterial({
        color: 0x44aaff,
        metalness: 0.5
    })
);

cuerpoAstro.position.y = 0.85;
astro.add(cuerpoAstro);

const cabezaAstro = esfera(
    0.42,
    new THREE.MeshStandardMaterial({
        color: 0xe9f2ff,
        metalness: 0.35
    }),
    0,
    1.65,
    0,
    astro
);

caja(
    0.65,
    0.22,
    0.12,
    MAT.neonAzul,
    0,
    1.68,
    0.36,
    astro
);

astro.position.set(0, 0, 0);
escena.add(astro);

// ============================================================
// 13. GEMAS Y CHECKPOINTS
// ============================================================

function crearGema(z, numero) {
    const grupo = new THREE.Group();

    const plataforma = caja(
        7,
        0.4,
        3.5,
        MAT.borde,
        0,
        0.05,
        z,
        grupo
    );

    plataforma.receiveShadow = true;

    const cristal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.8),
        MAT.neonRosa
    );

    cristal.position.y = 1.8;
    grupo.add(cristal);

    const anillo = new THREE.Mesh(
        new THREE.TorusGeometry(1.25, 0.08, 8, 48),
        MAT.neonAzul
    );

    anillo.rotation.x = Math.PI / 2;
    anillo.position.y = 0.5;
    grupo.add(anillo);

    grupo.position.z = z;
    escena.add(grupo);

    gemasObjetos.push({
        grupo,
        cristal,
        numero,
        recogida: false,
        z
    });

    crearDecoracion(z, "senal");
    crearDecoracion(z, "maquina");
}

let trofeo = null;

function crearTrofeo(z) {
    const grupo = new THREE.Group();

    caja(7, 0.5, 5, MAT.borde, 0, 0.1, 0, grupo);

    caja(1.5, 0.35, 1.5, MAT.neonAmarillo, 0, 0.6, 0, grupo);

    const copa = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.35, 1.5, 16),
        MAT.neonAmarillo
    );

    copa.position.y = 1.6;
    grupo.add(copa);

    esfera(0.65, MAT.neonAzul, 0, 2.5, 0, grupo);

    grupo.position.z = z;
    escena.add(grupo);

    trofeo = {
        grupo,
        z,
        activo: true
    };
}

// ============================================================
// 14. SIERRAS DE LA ZONA DIFICIL
// ============================================================

function crearSierra(x, z, velocidad) {
    const grupo = new THREE.Group();

    const disco = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 0.18, 12),
        MAT.metal
    );

    disco.rotation.x = Math.PI / 2;
    disco.position.y = 0.9;
    grupo.add(disco);

    for (let i = 0; i < 12; i++) {
        const angulo = i * Math.PI * 2 / 12;

        const diente = new THREE.Mesh(
            new THREE.ConeGeometry(0.2, 0.45, 3),
            MAT.neonRosa
        );

        diente.position.set(
            Math.cos(angulo) * 0.88,
            0.9 + Math.sin(angulo) * 0.88,
            0
        );

        diente.rotation.z = angulo - Math.PI / 2;
        grupo.add(diente);
    }

    grupo.position.set(x, 0, z);
    escena.add(grupo);

    sierras.push({
        grupo,
        velocidad,
        activo: true
    });
}

// ============================================================
// 15. MAPA PROGRESIVO
// ============================================================

// Se crean las tres etapas, pero solo la primera es visible.
// Al recoger cada gema se activa la siguiente etapa.

const etapas = [
    new THREE.Group(),
    new THREE.Group(),
    new THREE.Group()
];

// Guardamos cada objeto de una etapa dentro de un grupo.
// Asi podemos mostrar u ocultar la etapa completa.

function moverObjetosAGrupo(grupo, objetosAnteriores) {
    const nuevos = escena.children.filter(
        objeto => !objetosAnteriores.has(objeto)
    );

    for (const objeto of nuevos) {
        grupo.attach(objeto);
    }

    escena.add(grupo);
}

function construirEtapa(indice, constructor) {
    const existentes = new Set(escena.children);

    constructor();

    moverObjetosAGrupo(etapas[indice], existentes);
}

function construirMapa() {
    crearSuelo(-5, 105);
    crearCiudadLejana();

    // ETAPA 1: carros, agua, carros y primera gema.

    construirEtapa(0, () => {
        crearCarretera(5, 10, 3.3);
        crearRio(12, 17, 1.6);
        crearCarretera(19, 24, 4);
        crearGema(27, 1);
        crearDecoracion(2, "comida");
    });

    // ETAPA 2: mayor velocidad y segunda gema.

    construirEtapa(1, () => {
        crearCarretera(32, 38, 5.2);
        crearRio(40, 46, 2.4);
        crearCarretera(48, 54, 6.2);
        crearGema(57, 2);
        crearDecoracion(30, "maquina");
    });

    // ETAPA 3: vehiculos, sierras y trofeo.

    construirEtapa(2, () => {
        crearCarretera(62, 69, 7.5);

        for (let z = 72; z <= 82; z += 2.5) {
            crearSierra(
                -5 + Math.random() * 10,
                z,
                2.5 + Math.random() * 2
            );
        }

        crearTrofeo(88);
        crearDecoracion(85, "comida");
    });

    etapas[0].visible = true;
    etapas[1].visible = false;
    etapas[2].visible = false;
}

function activarEtapa(numero) {
    etapaActual = Math.max(etapaActual, numero);

    for (let i = 0; i < etapas.length; i++) {
        etapas[i].visible = i <= etapaActual;
    }
}

// ============================================================
// 16. CONTROLES
// ============================================================

window.addEventListener("keydown", e => {
    const tecla = e.key.toLowerCase();

    if (
        tecla.startsWith("arrow") ||
        tecla === " "
    ) {
        e.preventDefault();
    }

    teclas[tecla] = true;

    if (e.repeat) return;

    if (tecla === "tab") {
        e.preventDefault();
        modoCamara = modoCamara === 0 ? 1 : 0;
        camara.fov = modoCamara === 0 ? 70 : 80;
        camara.updateProjectionMatrix();
        actualizarHUD();
    }

    if (tecla === "p" || tecla === "escape") {
        cambiarPausa();
    }

    if (tecla === " " && estado === ESTADO.JUGANDO && enSuelo) {
        velocidadVertical = CONFIG.velocidadSalto;
        enSuelo = false;
    }
});

window.addEventListener("keyup", e => {
    teclas[e.key.toLowerCase()] = false;
});

window.addEventListener("blur", () => {
    for (const tecla in teclas) teclas[tecla] = false;
});

// ============================================================
// 17. MOVIMIENTO DEL JUGADOR
// ============================================================

function actualizarJugador(dt) {
    let dx = 0;
    let dz = 0;

    // Se conserva exactamente la asignacion solicitada.

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
        -CONFIG.limiteJugadorX,
        CONFIG.limiteJugadorX
    );

    astro.position.z = Math.max(
        checkpoint.z - 1.5,
        astro.position.z
    );

    if (!enSuelo) {
        velocidadVertical -= CONFIG.gravedad * dt;
        astro.position.y += velocidadVertical * dt;

        if (astro.position.y <= 0) {
            astro.position.y = 0;
            velocidadVertical = 0;
            enSuelo = true;
        }
    }

    if (invulnerable > 0) {
        invulnerable -= dt;
    }

    astro.visible =
        modoCamara === 0 &&
        (
            invulnerable <= 0 ||
            Math.floor(invulnerable * 10) % 2 === 0
        );
}

// ============================================================
// 18. MOVIMIENTO DE VEHICULOS Y TRONCOS
// ============================================================

function actualizarObstaculos(dt) {
    for (const carro of vehiculos) {
        if (!carro.activo || !carro.grupo.parent?.visible) continue;

        carro.grupo.position.x += carro.velocidad * dt;

        if (carro.velocidad > 0 &&
            carro.grupo.position.x > CONFIG.limiteVehiculos) {
            carro.grupo.position.x = -CONFIG.limiteVehiculos;
        }

        if (carro.velocidad < 0 &&
            carro.grupo.position.x < -CONFIG.limiteVehiculos) {
            carro.grupo.position.x = CONFIG.limiteVehiculos;
        }
    }

    for (const tronco of troncos) {
        if (!tronco.activo || !tronco.grupo.parent?.visible) continue;

        tronco.grupo.position.x += tronco.velocidad * dt;

        if (tronco.velocidad > 0 && tronco.grupo.position.x > 15) {
            tronco.grupo.position.x = -15;
        }

        if (tronco.velocidad < 0 && tronco.grupo.position.x < -15) {
            tronco.grupo.position.x = 15;
        }
    }

    for (const sierra of sierras) {
        if (!sierra.activo || !sierra.grupo.parent?.visible) continue;

        sierra.grupo.rotation.z += dt * 5;
        sierra.grupo.position.x += sierra.velocidad * dt;

        if (sierra.grupo.position.x > 9) {
            sierra.velocidad = -Math.abs(sierra.velocidad);
        }

        if (sierra.grupo.position.x < -9) {
            sierra.velocidad = Math.abs(sierra.velocidad);
        }
    }
}

// ============================================================
// 19. COLISIONES
// ============================================================

function perderVida() {
    if (invulnerable > 0 || estado !== ESTADO.JUGANDO) return;

    vidas--;
    actualizarHUD();

    if (vidas <= 0) {
        finalizar(false);
        return;
    }

    astro.position.copy(checkpoint);
    velocidadVertical = 0;
    enSuelo = true;
    invulnerable = CONFIG.invulnerabilidad;
}

function comprobarColisiones(dt) {
    const x = astro.position.x;
    const z = astro.position.z;

    // Colisiones con carros.

    for (const carro of vehiculos) {
        if (!carro.grupo.parent?.visible) continue;

        const cx = carro.grupo.position.x;
        const cz = carro.grupo.position.z;

        if (
            Math.abs(x - cx) < 1.6 &&
            Math.abs(z - cz) < 0.85 &&
            astro.position.y < 0.8
        ) {
            perderVida();
            return;
        }
    }

    // El jugador debe permanecer sobre un tronco
    // cuando se encuentre dentro del agua.

    const rio = zonasAgua.find(
        zona =>
            z >= zona.inicio &&
            z <= zona.final
    );

    if (rio && astro.position.y < 0.45) {
        let sostenido = false;

        for (const tronco of troncos) {
            if (!tronco.grupo.parent?.visible) continue;

            if (
                Math.abs(x - tronco.grupo.position.x) < 2.3 &&
                Math.abs(z - tronco.grupo.position.z) < 0.65
            ) {
                astro.position.x += tronco.velocidad * dt;
                sostenido = true;
                break;
            }
        }

        if (!sostenido) {
            perderVida();
            return;
        }
    }

    // Sierras.

    for (const sierra of sierras) {
        if (!sierra.grupo.parent?.visible) continue;

        if (
            Math.abs(x - sierra.grupo.position.x) < 1.1 &&
            Math.abs(z - sierra.grupo.position.z) < 0.7 &&
            astro.position.y < 1.5
        ) {
            perderVida();
            return;
        }
    }

    // Gemas y puntos de control.

    for (const gema of gemasObjetos) {
        if (gema.recogida || !gema.grupo.parent?.visible) continue;

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

    // Trofeo final.

    if (
        trofeo &&
        trofeo.activo &&
        gemas === 2 &&
        Math.abs(x) < 2.5 &&
        Math.abs(z - trofeo.z) < 2
    ) {
        trofeo.activo = false;
        puntos += 1000;
        finalizar(true);
    }
}

// ============================================================
// 20. CAMARAS
// ============================================================

const objetivoCamara = new THREE.Vector3();
const miradaCamara = new THREE.Vector3();

function actualizarCamara(dt) {
    if (modoCamara === 0) {
        objetivoCamara.set(
            astro.position.x,
            astro.position.y + 7,
            astro.position.z - 9
        );

        miradaCamara.set(
            astro.position.x,
            astro.position.y + 1,
            astro.position.z + 8
        );
    } else {
        // Primera persona desde los ojos del personaje.

        objetivoCamara.set(
            astro.position.x,
            astro.position.y + 1.7,
            astro.position.z + 0.15
        );

        miradaCamara.set(
            astro.position.x,
            astro.position.y + 1.7,
            astro.position.z + 12
        );
    }

    const factor = 1 - Math.exp(
        -CONFIG.velocidadCamara * dt
    );

    camara.position.lerp(objetivoCamara, factor);
    camara.lookAt(miradaCamara);
}

// ============================================================
// 21. ANIMACIONES DECORATIVAS
// ============================================================

function actualizarDecoracion(dt) {
    for (const nave of naves) {
        nave.grupo.position.x += nave.velocidad * dt;

        nave.grupo.position.y =
            nave.origenY +
            Math.sin(tiempoGlobal + nave.fase) * 0.8;

        if (nave.grupo.position.x > 95) {
            nave.grupo.position.x = -95;
        }
    }

    for (const gema of gemasObjetos) {
        if (!gema.recogida && gema.grupo.parent?.visible) {
            gema.cristal.rotation.y += dt * 1.5;
            gema.cristal.position.y =
                1.8 + Math.sin(tiempoGlobal * 2) * 0.2;
        }
    }

    if (trofeo && trofeo.grupo.parent?.visible) {
        trofeo.grupo.rotation.y =
            Math.sin(tiempoGlobal * 0.6) * 0.08;
    }
}

// ============================================================
// 22. INICIO, PAUSA Y FIN DEL JUEGO
// ============================================================

function iniciarJuego() {
    estado = ESTADO.JUGANDO;

    vidas = CONFIG.vidas;
    puntos = 0;
    gemas = 0;
    tiempo = CONFIG.tiempo;
    etapaActual = 0;
    invulnerable = 0;
    velocidadVertical = 0;
    enSuelo = true;

    checkpoint.set(0, 0, 0);
    astro.position.copy(checkpoint);

    activarEtapa(0);

    for (const gema of gemasObjetos) {
        gema.recogida = false;
        gema.cristal.visible = true;
    }

    if (trofeo) trofeo.activo = true;

    actualizarHUD();
    ocultarOverlay();

    if (pausaPanel) pausaPanel.style.display = "none";
}

function cambiarPausa() {
    if (estado === ESTADO.JUGANDO) {
        estado = ESTADO.PAUSA;
        if (pausaPanel) pausaPanel.style.display = "flex";
    } else if (estado === ESTADO.PAUSA) {
        estado = ESTADO.JUGANDO;
        if (pausaPanel) pausaPanel.style.display = "none";
    }
}

function finalizar(victoria) {
    estado = victoria ? ESTADO.VICTORIA : ESTADO.DERROTA;

    mostrarOverlay(
        victoria ? "MISION COMPLETADA" : "GAME OVER",
        victoria ? "Has conseguido el trofeo" : "Fin del recorrido",
        victoria
            ? `Conseguiste ${gemas} gemas y ${puntos} puntos.`
            : `Conseguiste ${gemas} gemas. Intentalo otra vez.`,
        "Volver a jugar"
    );
}

if (btnJugar) {
    btnJugar.addEventListener("click", iniciarJuego);
}

if (btnContinuar) {
    btnContinuar.addEventListener("click", cambiarPausa);
}

// ============================================================
// 23. BUCLE PRINCIPAL
// ============================================================

function animar(milisegundos) {
    requestAnimationFrame(animar);

    const dt = Math.min(
        (milisegundos - ultimoTiempo) / 1000 || 0,
        0.05
    );

    ultimoTiempo = milisegundos;

    if (estado === ESTADO.JUGANDO) {
        tiempoGlobal += dt;
        tiempo -= dt;

        actualizarJugador(dt);
        actualizarObstaculos(dt);
        comprobarColisiones(dt);
        actualizarDecoracion(dt);

        if (tiempo <= 0) {
            tiempo = 0;
            finalizar(false);
        }

        actualizarHUD();
    }

    actualizarCamara(dt);

    renderer.render(escena, camara);
}

// ============================================================
// 24. AJUSTE DE VENTANA
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
// 25. INICIALIZACION
// ============================================================

async function inicializar() {
    crearGalaxia();
    crearTraficoAereo();

    await cargarModelos();

    construirMapa();

    actualizarHUD();

    mostrarOverlay(
        "ASTRO & BOLT",
        "CRUCE IMPOSIBLE 3D",
        "Consigue las dos gemas, supera los obstaculos y alcanza el trofeo.",
        "Jugar"
    );

    requestAnimationFrame(animar);
}

inicializar();