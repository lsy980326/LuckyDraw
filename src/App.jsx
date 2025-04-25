import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three'; // Make sure 'three' is installed (npm install three)
import './App.css'; // Import the CSS file

// --- Configuration Constants ---
const NUM_WINNERS = 3;
const RACE_DISTANCE = 150;
const BASE_SPEED = 0.14;
const SPEED_VARIATION = 0.10;
const CAMERA_FOLLOW_LERP = 0.025;
const TRACK_WIDTH = 40;
const LABEL_Y_OFFSET = 2.8;
const LABEL_SCALE = 5;
const RACER_BOBBING_AMOUNT = 0.15;
const RACER_BOBBING_SPEED_FACTOR = 15;
const RANDOM_SPEED_BURST_CHANCE = 0.015;
const RANDOM_SPEED_BURST_FACTOR = 1.8;
const RANDOM_SLOWDOWN_CHANCE = 0.01;
const RANDOM_SLOWDOWN_FACTOR = 0.5;
const FIRST_PLACE_COLOR = new THREE.Color(0xFFD700);
const SECOND_PLACE_COLOR = new THREE.Color(0xC0C0C0);
const THIRD_PLACE_COLOR = new THREE.Color(0xCD7F32);
const DEFAULT_LABEL_COLOR = new THREE.Color(0xFFFFFF);
const NAME_PREFIXES = ["행운의", "즐거운", "신나는", "멋진", "특별한", "놀라운", "빛나는"];
const NAME_SUFFIXES = ["참가자", "도전자", "레이서", "주자", "선수", "행운아", "꿈나무"];
const initialCameraPosition = new THREE.Vector3(0, 18, -25);

// --- React Component ---
function App() {
    // --- State Management ---
    const [numPlayers, setNumPlayers] = useState(20);
    const [playerNamesInput, setPlayerNamesInput] = useState('');
    const [validationError, setValidationError] = useState('');
    const [showSetup, setShowSetup] = useState(true);
    const [showResults, setShowResults] = useState(false);
    const [isRaceRunning, setIsRaceRunning] = useState(false);
    const [liveRanking, setLiveRanking] = useState({ rank1: '---', rank2: '---', rank3: '---' });
    const [finalResults, setFinalResults] = useState({ winner1: '---', winner2: '---', winner3: '---' });
    const [tooltip, setTooltip] = useState({ visible: false, content: '', x: 0, y: 0 });

    // --- Refs for Three.js and non-state values ---
    const mountRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const clockRef = useRef(null);
    const racersRef = useRef([]);
    const animationFrameIdRef = useRef(null);
    const mouseRef = useRef(new THREE.Vector2());
    const clientMouseRef = useRef({ x: 0, y: 0 });
    const raycasterRef = useRef(new THREE.Raycaster());
    const hoveredRacerRef = useRef(null);
    const cameraTargetZRef = useRef(0);
    const isRaceFinishedRef = useRef(false);

    // --- Refs to pass state setters to animation/callback loops safely ---
    const liveRankingSetterRef = useRef(setLiveRanking);
    const finalResultsSetterRef = useRef(setFinalResults);
    const isRaceRunningSetterRef = useRef(setIsRaceRunning);
    const showResultsSetterRef = useRef(setShowResults);

    // --- Utility Functions (Memoized with useCallback) ---

    const createCheckerboardTexture = useCallback((widthToCover) => {
        const size = 16; const data = new Uint8Array(size * size * 3);
        for (let y = 0; y < size; y++) { for (let x = 0; x < size; x++) {
            const isWhite = ((x % 4 < 2) !== (y % 4 < 2)); const color = isWhite ? 255 : 0;
            const stride = (y * size + x) * 3; data[stride] = data[stride + 1] = data[stride + 2] = color;
        }}
        const texture = new THREE.DataTexture(data, size, size, THREE.RGBFormat);
        texture.needsUpdate = true;
        texture.magFilter = THREE.NearestFilter;
        // Disable mipmaps for DataTexture with RGBFormat
        texture.minFilter = THREE.NearestFilter;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(widthToCover / 4, 1);
        return texture;
    }, []);

    const createNameLabel = useCallback((text) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = 22;
        context.font = `Bold ${fontSize}px Arial`;
        const textMetrics = context.measureText(text);
        const canvasWidth = textMetrics.width + 16;
        const canvasHeight = fontSize + 8;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        context.font = `Bold ${fontSize}px Arial`;
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = 'rgba(255, 255, 255, 0.95)';
        context.fillText(text, canvasWidth / 2, canvasHeight / 2);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(LABEL_SCALE * (canvasWidth / canvasHeight), LABEL_SCALE, 1);
        return sprite;
    }, []);

    const clearRacers = useCallback(() => {
        console.log("Clearing racers..."); // Log cleanup start
        if (!sceneRef.current) {
            console.log("Scene ref not found during cleanup.");
            return;
        }
        const racersToRemove = [...racersRef.current];
        console.log(`Found ${racersToRemove.length} racers to remove.`);
        racersToRemove.forEach((racer, index) => {
            // console.log(`Removing racer ${index}: ${racer.name}`);
            if (racer.mesh) {
                sceneRef.current.remove(racer.mesh);
                if (racer.mesh.geometry) {
                    // console.log(`Disposing mesh geometry for ${racer.name}`);
                    racer.mesh.geometry.dispose();
                }
                if (racer.mesh.material) {
                    // console.log(`Disposing mesh material for ${racer.name}`);
                    racer.mesh.material.dispose();
                }
            } else {
                 console.log(`Racer ${index} has no mesh.`);
            }
            if (racer.labelSprite) {
                sceneRef.current.remove(racer.labelSprite);
                if (racer.labelSprite.material) {
                    if (racer.labelSprite.material.map) {
                        // console.log(`Disposing label map for ${racer.name}`);
                        racer.labelSprite.material.map.dispose();
                    }
                    // console.log(`Disposing label material for ${racer.name}`);
                    racer.labelSprite.material.dispose();
                }
            } else {
                 console.log(`Racer ${index} has no labelSprite.`);
            }
        });
        racersRef.current = [];
        liveRankingSetterRef.current({ rank1: '---', rank2: '---', rank3: '---' });
        console.log("Racers cleared.");
    }, []); // Removed sceneRef from deps, using ref directly is fine

    const createRacers = useCallback((currentNumPlayers, currentPlayerNames) => {
        console.log(`Creating ${currentNumPlayers} racers...`);
        if (!sceneRef.current || !cameraRef.current) {
            console.error("Cannot create racers: scene or camera ref is missing.");
            return;
        }
        clearRacers(); // Clear previous racers first

        const startLineZ = 0;
        const spacing = currentNumPlayers > 1 ? TRACK_WIDTH / currentNumPlayers : 0;
        console.log(`Racer spacing: ${spacing}`);

        const racerGeometry = new THREE.ConeGeometry(0.9, 2.8, 16);
        racerGeometry.rotateX(Math.PI / 2);
        const baseMaterial = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.4 });
        const newRacers = [];

        for (let i = 0; i < currentNumPlayers; i++) {
            const racerMaterial = baseMaterial.clone();
            racerMaterial.color.setHSL(Math.random(), 0.7, 0.6);
            const racerMesh = new THREE.Mesh(racerGeometry, racerMaterial);
            const posX = currentNumPlayers > 1 ? -TRACK_WIDTH / 2 + spacing * (i + 0.5) : 0;
            racerMesh.position.set(posX, 0.5, startLineZ);
            racerMesh.castShadow = true;
            const playerName = currentPlayerNames[i];
            racerMesh.userData = { name: playerName };
            const labelSprite = createNameLabel(playerName);
            labelSprite.position.set(posX, racerMesh.position.y + LABEL_Y_OFFSET, startLineZ);

            console.log(`Adding racer ${i} (${playerName}) at position: x=${posX.toFixed(2)}, y=${racerMesh.position.y}, z=${racerMesh.position.z}`);
            sceneRef.current.add(racerMesh);
            sceneRef.current.add(labelSprite);
            newRacers.push({
                id: i, mesh: racerMesh, labelSprite: labelSprite, name: playerName,
                speed: 0, targetZ: startLineZ, burstFactor: 1.0,
                bobOffset: Math.random() * Math.PI * 2, finishTime: -1
            });
        }

        // Dispose base geometry/material if they are not reused elsewhere
        // racerGeometry.dispose(); // Only if created ONLY inside this function
        // baseMaterial.dispose();

        racersRef.current = newRacers;
        console.log("Racers created and added to scene.");

        // Reset camera and ranking display
        cameraRef.current.position.copy(initialCameraPosition);
        cameraRef.current.lookAt(0, 0, 0);
        cameraTargetZRef.current = 0;
        liveRankingSetterRef.current({ rank1: '---', rank2: '---', rank3: '---' });

    }, [clearRacers, createNameLabel]); // Dependencies

    const generateRandomNames = useCallback((count) => {
        const names = new Set();
        for (let i = 1; i <= count; i++) { names.add(`참가자 ${i}`); }
        let nameArray = Array.from(names);
        for (let i = nameArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [nameArray[i], nameArray[j]] = [nameArray[j], nameArray[i]];
        }
        return nameArray.slice(0, count);
    }, []);

    // --- Event Handlers ---

    const handleNumPlayersChange = (event) => {
        setNumPlayers(parseInt(event.target.value, 10) || 0);
    };

    const handleNamesChange = (event) => {
        setPlayerNamesInput(event.target.value);
    };

    const handleMouseMove = useCallback((event) => {
        if (!mountRef.current) return;
        const rect = mountRef.current.getBoundingClientRect();
        clientMouseRef.current = { x: event.clientX, y: event.clientY };
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }, []);

    const handleSetupAndStart = useCallback(() => {
        if (isRaceRunning) { console.warn("Cannot start: Race is already in progress."); return; }
        if (isRaceFinishedRef.current) { console.warn("Cannot start: Race finished. Click 'New Draw Setup' first."); return; }

        setValidationError('');
        const namesFromInput = playerNamesInput.split('\n').map(name => name.trim()).filter(name => name.length > 0);
        const numNamesEntered = namesFromInput.length;
        let currentNumPlayers = numPlayers;
        let currentPlayerNames = [];

        if (numNamesEntered > 0) {
            if (numNamesEntered < 2) { setValidationError('Please enter at least 2 names, or leave the names blank and specify the number.'); return; }
            currentNumPlayers = numNamesEntered;
            currentPlayerNames = namesFromInput;
            setNumPlayers(currentNumPlayers);
            console.log(`Using ${currentNumPlayers} entered names.`);
        } else {
            if (isNaN(currentNumPlayers) || currentNumPlayers < 2) { setValidationError('If names are blank, please enter a valid number of racers (at least 2).'); return; }
            currentPlayerNames = generateRandomNames(currentNumPlayers);
            console.log(`Generated ${currentNumPlayers} random names.`);
        }
        if (NUM_WINNERS > currentNumPlayers) { console.warn(`Warning: Number of winners to display (${NUM_WINNERS}) is more than the number of racers (${currentNumPlayers}). Adjusting display.`); }

        setShowSetup(false);
        setShowResults(false);
        isRaceFinishedRef.current = false;

        createRacers(currentNumPlayers, currentPlayerNames); // Create racers now

        // Delay starting the animation slightly to ensure scene setup is complete? (Usually not needed)
        // setTimeout(() => {
            console.log("Setting isRaceRunning to true");
            setIsRaceRunning(true);
            if (clockRef.current) clockRef.current.start();
        // }, 0);


    }, [numPlayers, playerNamesInput, isRaceRunning, createRacers, generateRandomNames]);

    const prepareForNewSetup = useCallback(() => {
        if (isRaceRunning) { console.warn("Cannot reset setup while race is in progress."); return; }

        console.log("Preparing for new setup...");
        setShowResults(false);
        setShowSetup(true);
        clearRacers(); // This also resets live ranking UI

        if (cameraRef.current) {
            cameraRef.current.position.copy(initialCameraPosition);
            cameraRef.current.lookAt(0, 0, 0);
        }
        cameraTargetZRef.current = 0;
        isRaceFinishedRef.current = false;
        setIsRaceRunning(false);

        setValidationError('');
        setFinalResults({ winner1: '---', winner2: '---', winner3: '---' });

    }, [isRaceRunning, clearRacers]);

    // --- Finish Race Logic ---
    const finishRace = useCallback(() => {
        if (isRaceFinishedRef.current) return;
        console.log("Draw Finished! Stopping animation and showing results.");
        isRaceFinishedRef.current = true;
        if (clockRef.current) clockRef.current.stop();

        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
            console.log("Animation frame cancelled by finishRace.");
        }

        const finalRanking = [...racersRef.current]
            .filter(r => r.finishTime >= 0)
            .sort((a, b) => a.finishTime - b.finishTime);

        console.log("Final Ranking:", finalRanking.map(r => `${r.name}: ${r.finishTime.toFixed(2)}s`));

        finalResultsSetterRef.current({
            winner1: finalRanking[0]?.name || '---',
            winner2: finalRanking[1]?.name || '---',
            winner3: finalRanking[2]?.name || '---'
        });

        racersRef.current.forEach(racer => {
            if (racer.labelSprite.material) {
                racer.labelSprite.material.color.set(DEFAULT_LABEL_COLOR);
            }
        });

        showResultsSetterRef.current(true); // Show results overlay
        isRaceRunningSetterRef.current(false); // Set running state to false

    }, []); // Empty deps ok

    // --- Tooltip Update Logic ---
    const updateTooltip = useCallback(() => {
        if (racersRef.current.length === 0 || !cameraRef.current) {
            if (tooltip.visible) setTooltip(prev => ({ ...prev, visible: false }));
            hoveredRacerRef.current = null;
            return;
        }
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const racerMeshes = racersRef.current.map(r => r.mesh).filter(mesh => !!mesh);
        if (racerMeshes.length === 0) return;

        const intersects = raycasterRef.current.intersectObjects(racerMeshes);

        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            if (hoveredRacerRef.current !== intersectedObject || !tooltip.visible) {
                hoveredRacerRef.current = intersectedObject;
                const racerData = racersRef.current.find(r => r.mesh === hoveredRacerRef.current);
                setTooltip({
                    visible: true,
                    content: racerData?.name || "Unknown Racer",
                    x: clientMouseRef.current.x + 15,
                    y: clientMouseRef.current.y + 15
                });
            } else {
                 setTooltip(prev => ({
                     ...prev,
                     x: clientMouseRef.current.x + 15,
                     y: clientMouseRef.current.y + 15
                 }));
            }
        } else {
            if (hoveredRacerRef.current) {
                setTooltip(prev => ({ ...prev, visible: false }));
            }
            hoveredRacerRef.current = null;
        }
    }, [tooltip.visible]);

    // --- Animation Loop Logic ---
    const animate = useCallback(() => {
        if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !clockRef.current || !racersRef.current) {
            console.error("Animation dependencies missing, stopping loop.");
            isRaceRunningSetterRef.current(false);
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
            return;
        }
        // Stop loop if finished flag is set
        if (isRaceFinishedRef.current) {
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
            console.log("Animate: Stopping because race finished flag is true.");
            return;
        }

        const deltaTime = clockRef.current.getDelta();
        const elapsedTime = clockRef.current.getElapsedTime();
        let leadingZ = 0;
        let activeRacers = 0;

        // Update racers
        racersRef.current.forEach((racer) => {
            if (racer.mesh.position.z < RACE_DISTANCE) {
                activeRacers++;
                let currentTargetSpeed = BASE_SPEED + (Math.random() - 0.5) * SPEED_VARIATION;
                racer.burstFactor = 1.0;
                 if (Math.random() < RANDOM_SPEED_BURST_CHANCE) { racer.burstFactor = RANDOM_SPEED_BURST_FACTOR; }
                 else if (Math.random() < RANDOM_SLOWDOWN_CHANCE) { racer.burstFactor = RANDOM_SLOWDOWN_FACTOR; }
                racer.speed = Math.max(0.02, currentTargetSpeed) * racer.burstFactor;
                let deltaZ = racer.speed * (60 * deltaTime);
                racer.mesh.position.z += deltaZ;

                if (racer.mesh.position.z >= RACE_DISTANCE) {
                    racer.mesh.position.z = RACE_DISTANCE;
                    if (racer.finishTime < 0) { racer.finishTime = elapsedTime; }
                }
                const bobY = Math.sin(elapsedTime * RACER_BOBBING_SPEED_FACTOR * (0.8 + racer.speed * 0.5) + racer.bobOffset) * RACER_BOBBING_AMOUNT;
                racer.mesh.position.y = 0.5 + bobY;
                racer.labelSprite.position.z = racer.mesh.position.z;
                racer.labelSprite.position.y = racer.mesh.position.y + LABEL_Y_OFFSET;
            } else {
                racer.mesh.position.z = RACE_DISTANCE;
                racer.labelSprite.position.z = RACE_DISTANCE;
                racer.mesh.position.y = 0.5;
                racer.labelSprite.position.y = 0.5 + LABEL_Y_OFFSET;
            }
             leadingZ = Math.max(leadingZ, racer.mesh.position.z);
        });

        // Update ranking and colors
        if (racersRef.current.length > 0) {
            const sortedRacers = [...racersRef.current].sort((a, b) => {
                if (b.mesh.position.z !== a.mesh.position.z) return b.mesh.position.z - a.mesh.position.z;
                if (a.finishTime < 0 && b.finishTime < 0) return 0;
                if (a.finishTime < 0) return 1;
                if (b.finishTime < 0) return -1;
                return a.finishTime - b.finishTime;
            });
            liveRankingSetterRef.current({
                rank1: sortedRacers[0]?.name || '---',
                rank2: sortedRacers[1]?.name || '---',
                rank3: sortedRacers[2]?.name || '---'
            });
            racersRef.current.forEach(racer => {
                const currentRank = sortedRacers.findIndex(sr => sr.id === racer.id);
                let targetColor = DEFAULT_LABEL_COLOR;
                if (currentRank === 0) targetColor = FIRST_PLACE_COLOR;
                else if (currentRank === 1) targetColor = SECOND_PLACE_COLOR;
                else if (currentRank === 2) targetColor = THIRD_PLACE_COLOR;
                if (racer.labelSprite.material) {
                     racer.labelSprite.material.color.lerp(targetColor, 0.1);
                }
            });
        }

        // Update camera
        cameraTargetZRef.current = Math.max(0, leadingZ);
        const cameraZOffset = -28 - Math.min(cameraTargetZRef.current * 0.05, 5);
        if (cameraRef.current) { // Check cameraRef exists
            cameraRef.current.position.z = THREE.MathUtils.lerp(cameraRef.current.position.z, cameraTargetZRef.current + cameraZOffset, CAMERA_FOLLOW_LERP);
            const targetCameraY = 18 + Math.min(cameraTargetZRef.current * 0.05, 5);
            cameraRef.current.position.y = THREE.MathUtils.lerp(cameraRef.current.position.y, targetCameraY, CAMERA_FOLLOW_LERP * 0.5);
            let lookAtTarget = new THREE.Vector3(0, 2, cameraTargetZRef.current + 10);
            const wobbleX = Math.sin(elapsedTime * 0.8) * 0.5;
            cameraRef.current.position.x = THREE.MathUtils.lerp(cameraRef.current.position.x, wobbleX, CAMERA_FOLLOW_LERP * 0.3);
            cameraRef.current.lookAt(lookAtTarget);
        }

        // Finish check
        if (activeRacers === 0 && racersRef.current.length > 0 && !isRaceFinishedRef.current) {
            finishRace();
        }

        updateTooltip(); // Update tooltip

        // Render
        if (rendererRef.current && sceneRef.current && cameraRef.current) { // Check refs before rendering
             rendererRef.current.render(sceneRef.current, cameraRef.current);
        }

        // Request next frame ONLY if race is not finished
        if (!isRaceFinishedRef.current) {
            animationFrameIdRef.current = requestAnimationFrame(animate);
        } else {
            console.log("Animate: Not requesting next frame because race finished.");
        }
    }, [finishRace, updateTooltip]);

    // --- useEffect for Three.js Initialization and Cleanup ---
    useEffect(() => {
        console.log("Init useEffect running...");
        if (!mountRef.current) {
             console.log("Mount ref not ready yet.");
             return;
        }
        const currentMount = mountRef.current;
        let rendererInstance; // Variable to hold the created renderer for cleanup

        console.log("Initializing Three.js...");
        sceneRef.current = new THREE.Scene();
        sceneRef.current.background = new THREE.Color(0x1a1a2a);
        sceneRef.current.fog = new THREE.Fog(0x1a1a2a, RACE_DISTANCE * 0.4, RACE_DISTANCE * 1.3);

        const initialWidth = currentMount.clientWidth || 1; // Avoid 0 width
        const initialHeight = currentMount.clientHeight || 1; // Avoid 0 height
        console.log(`Mount dimensions for camera: ${initialWidth}x${initialHeight}`);

        cameraRef.current = new THREE.PerspectiveCamera(75, initialWidth / initialHeight, 0.1, 1000);
        cameraRef.current.position.copy(initialCameraPosition);
        cameraRef.current.lookAt(0, 0, 0);
        console.log("Camera initialized:", cameraRef.current.position);


        try {
            rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
            rendererInstance = rendererRef.current; // Store for cleanup
            rendererRef.current.setPixelRatio(window.devicePixelRatio);
            rendererRef.current.shadowMap.enabled = true;
            currentMount.appendChild(rendererRef.current.domElement);
            // Set size *after* appending to DOM might sometimes help get correct dimensions
            rendererRef.current.setSize(currentMount.clientWidth, currentMount.clientHeight);
             console.log("Renderer initialized and appended. Size:", rendererRef.current.getSize(new THREE.Vector2()));
        } catch(error) {
            console.error("Error creating WebGL Renderer:", error);
            // Handle context creation failure (e.g., show error message to user)
            setValidationError("Could not initialize WebGL. Please check your browser/GPU compatibility.");
            return; // Stop initialization if renderer fails
        }

        clockRef.current = new THREE.Clock();

        // --- Lights setup ---
        const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
        sceneRef.current.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
        directionalLight.position.set(5, 50, -40);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -TRACK_WIDTH * 1.2;
        directionalLight.shadow.camera.right = TRACK_WIDTH * 1.2;
        directionalLight.shadow.camera.top = 60;
        directionalLight.shadow.camera.bottom = -60;
        sceneRef.current.add(directionalLight);
        const hemiLight = new THREE.HemisphereLight( 0x446688, 0x112233, 0.3 );
	    sceneRef.current.add( hemiLight );
        console.log("Lights added.");

        // --- Ground/Track setup ---
        const trackGeometry = new THREE.PlaneGeometry(TRACK_WIDTH * 1.8, RACE_DISTANCE * 1.6);
        const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x38384d, roughness: 0.9, metalness: 0.1, side: THREE.DoubleSide });
        const track = new THREE.Mesh(trackGeometry, trackMaterial);
        track.rotation.x = -Math.PI / 2;
        track.position.y = -0.5;
        track.position.z = RACE_DISTANCE / 2 - 20;
        track.receiveShadow = true;
        sceneRef.current.add(track);
        console.log("Track added.");

        // --- Finish Line setup ---
        const finishLineGeo = new THREE.PlaneGeometry(TRACK_WIDTH + 10, 3);
        const finishLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: createCheckerboardTexture(TRACK_WIDTH + 10), side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
        const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
        finishLine.rotation.x = -Math.PI / 2;
        finishLine.position.set(0, -0.45, RACE_DISTANCE);
        sceneRef.current.add(finishLine);
        console.log("Finish line added.");

        // --- Event Listeners Setup ---
        const handleResize = () => {
            if (!rendererInstance || !cameraRef.current || !currentMount) return;
            const width = currentMount.clientWidth;
            const height = currentMount.clientHeight;
            if (height === 0) return;
            console.log(`Resizing to ${width}x${height}`);
            cameraRef.current.aspect = width / height;
            cameraRef.current.updateProjectionMatrix();
            rendererInstance.setSize(width, height);
            // Re-render after resize (optional, but good for static scenes)
            // rendererInstance.render(sceneRef.current, cameraRef.current);
        };

        handleResize(); // Call once after setup

        window.addEventListener('resize', handleResize);
        currentMount.addEventListener('mousemove', handleMouseMove);
        console.log("Event listeners added.");

        // --- Initial render ---
        try {
            console.log("Attempting initial render...");
             if (rendererInstance && sceneRef.current && cameraRef.current) {
                rendererInstance.render(sceneRef.current, cameraRef.current);
                console.log("Initial render successful.");
            } else {
                 console.warn("Skipping initial render: refs not ready.");
            }
        } catch (error) {
             console.error("Error during initial render:", error);
        }


        // --- Cleanup Function ---
        return () => {
            console.log("Cleanup: Running useEffect cleanup...");
            window.removeEventListener('resize', handleResize);
            if (currentMount) {
                currentMount.removeEventListener('mousemove', handleMouseMove);
                 console.log("Cleanup: Removed mousemove listener.");
            } else {
                 console.log("Cleanup: currentMount not found for mousemove removal.");
            }

            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
                console.log("Cleanup: Cancelled animation frame.");
            }
            clearRacers(); // Dispose racer resources

            console.log("Cleanup: Disposing scene objects...");
            sceneRef.current?.traverse(object => {
                 if (object.geometry) object.geometry.dispose();
                 if (object.material) {
                      if (Array.isArray(object.material)) {
                          object.material.forEach(material => {
                               if(material.map) material.map.dispose();
                               material.dispose();
                          });
                      } else {
                          if(object.material.map) object.material.map.dispose();
                          object.material.dispose();
                      }
                 }
                 if (object.texture) object.texture.dispose();
            });
            console.log("Cleanup: Scene objects disposed.");

            if (rendererInstance) {
                console.log("Cleanup: Disposing renderer...");
                rendererInstance.dispose();
                if (rendererInstance.domElement && currentMount?.contains(rendererInstance.domElement)) {
                    try {
                         currentMount.removeChild(rendererInstance.domElement);
                         console.log("Cleanup: Removed renderer DOM element.");
                        }
                    catch (error) { console.warn("Cleanup: Could not remove renderer DOM element:", error); }
                } else {
                    console.log("Cleanup: Renderer DOM element not found or not in mount.");
                }
            } else {
                 console.log("Cleanup: Renderer instance not found.");
            }

            // Nullify refs
            sceneRef.current = null;
            cameraRef.current = null;
            rendererRef.current = null; // Ensure rendererRef is also nulled
            clockRef.current = null;
            racersRef.current = [];
            console.log("Cleanup: Refs nulled. Cleanup complete.");
        };
        // Dependencies for initialization effect
    }, [createCheckerboardTexture, handleMouseMove, clearRacers, createNameLabel]);


    // --- useEffect for Starting/Stopping Animation Loop ---
    useEffect(() => {
        if (isRaceRunning) {
            console.log("Starting animation loop via useEffect [isRaceRunning]...");
            isRaceFinishedRef.current = false; // Reset finish flag
            if (animationFrameIdRef.current) { cancelAnimationFrame(animationFrameIdRef.current); } // Clear previous frame just in case
            animationFrameIdRef.current = requestAnimationFrame(animate); // Start the loop
        } else {
             // If race is not running, ensure the loop is stopped
             if (animationFrameIdRef.current) {
                 console.log("Stopping animation loop via useEffect [isRaceRunning] false...");
                 cancelAnimationFrame(animationFrameIdRef.current);
                 animationFrameIdRef.current = null;
             }
        }
        // Cleanup for this effect: stop the loop if isRaceRunning becomes false, or on unmount
        return () => {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
                 console.log("Animation loop stopped on effect cleanup [isRaceRunning].");
            }
        };
    }, [isRaceRunning, animate]); // Depend on isRaceRunning state and the animate callback

    // --- useEffect for Updating Setter Refs ---
    // This ensures the refs always point to the latest setter functions
    useEffect(() => {
        liveRankingSetterRef.current = setLiveRanking;
        finalResultsSetterRef.current = setFinalResults;
        isRaceRunningSetterRef.current = setIsRaceRunning;
        showResultsSetterRef.current = setShowResults;
    }); // No dependency array, runs on every render


    // --- JSX Structure ---
    return (
        <div className="app-container">
            {/* Setup Overlay */}
            <div className={`overlay setup-overlay ${showSetup ? '' : 'hidden'}`}>
                <h1>Random Racer Draw</h1>
                <div className="input-group">
                    <label htmlFor="numPlayersInput">Number of Racers (e.g., 20):</label>
                    <input
                        type="number"
                        id="numPlayersInput"
                        value={numPlayers}
                        onChange={handleNumPlayersChange}
                        min="2"
                        disabled={isRaceRunning}
                    />
                </div>
                <div className="input-group">
                    <label htmlFor="playerNamesInput">Enter Racer Names (one per line):</label>
                    <textarea
                        id="playerNamesInput"
                        rows="10"
                        placeholder="참가자 1
참가자 2
참가자 3
...etc"
                        value={playerNamesInput}
                        onChange={handleNamesChange}
                        disabled={isRaceRunning}
                    />
                </div>
                <button
                    id="startButton"
                    className="action-button"
                    onClick={handleSetupAndStart}
                    disabled={isRaceRunning}
                >
                    {isRaceRunning ? "Draw in Progress..." : "Setup & Start Draw!"}
                </button>
                <p className="error-message">{validationError}</p>
            </div>

            {/* Results Overlay */}
            <div className={`overlay results-overlay ${showResults ? '' : 'hidden'}`}>
                <h2>Draw Results!</h2>
                <div className="winner-list">
                    <p>🥇 <span id="winner1">{finalResults.winner1}</span></p>
                    <p>🥈 <span id="winner2">{finalResults.winner2}</span></p>
                    <p>🥉 <span id="winner3">{finalResults.winner3}</span></p>
                </div>
                <button
                    id="restartButton" // Ensure this ID exists in your actual HTML if needed, though onClick handles it
                    className="restart-button"
                    onClick={prepareForNewSetup}
                >
                    New Draw Setup
                </button>
                <p><small>(Click "New Draw Setup" to run again)</small></p>
            </div>

            {/* Live Ranking Display */}
            <div className={`live-ranking ${isRaceRunning ? 'visible' : ''}`}>
                <h3>Live Ranking</h3>
                <p>1st: <span id="rank1">{liveRanking.rank1}</span></p>
                <p>2nd: <span id="rank2">{liveRanking.rank2}</span></p>
                <p>3rd: <span id="rank3">{liveRanking.rank3}</span></p>
            </div>

            {/* Three.js Mount Point */}
            <div ref={mountRef} className="three-mount"></div>

            {/* Tooltip */}
            <div
                className={`tooltip ${tooltip.visible ? 'visible' : ''}`}
                style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
            >
                {tooltip.content}
            </div>
        </div>
    );
}

export default App;