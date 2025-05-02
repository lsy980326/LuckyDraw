// src/App.jsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import "./App.css"; // CSS 파일 import
import { handleSkillEvents, SPEED_BOOST_FACTOR } from "./skills"; // 스킬 핸들러 및 상수 import
import * as VideoRecorder from "./videoRecorder"; // 비디오 레코더 import (getDisplayMedia 버전 사용 가정)

// --- 환경 설정 상수 ---
const NUM_WINNERS = 3; // 최종 결과에 표시할 우승자 수
const RACE_DISTANCE = 200; // 경주 거리 200m
const BASE_SPEED = 0.14; // 기본 속도 배율
const SPEED_VARIATION = 0.1; // 속도 무작위성 요소
const CAMERA_FOLLOW_LERP = 0.03; // 카메라 추적 부드러움
const TRACK_WIDTH = 40; // 레이싱 영역 너비
const LABEL_Y_OFFSET = 2.5; // 이름표 기본 높이 오프셋
const LABEL_SCALE = 4.0; // 이름표 크기
const RACER_WIDTH = 0.8; // 레이서 너비
const RACER_HEIGHT = 2.5; // 레이서 높이
const CAMERA_FOV = 80; // 카메라 시야각
const initialCameraPosition = new THREE.Vector3(0, 28, -45); // 카메라 시작 위치
const RACER_BOBBING_AMOUNT = 0.15; // 레이서 상하 움직임 정도
const RACER_BOBBING_SPEED_FACTOR = 15; // 레이서 상하 움직임 속도
const RANDOM_SPEED_BURST_CHANCE = 0.015; // 속도 폭발 확률 (기본 랜덤 요소)
const RANDOM_SPEED_BURST_FACTOR = 1.8; // 속도 폭발 배율
const RANDOM_SLOWDOWN_CHANCE = 0.01; // 감속 확률 (기본 랜덤 요소)
const RANDOM_SLOWDOWN_FACTOR = 0.5; // 감속 배율
const MARKER_INTERVAL = 50; // 거리 표시 마커 간격 (m)
const SPEED_DISPLAY_SCALING_FACTOR = 180; // 속도 표시 값 조절 계수
// --- 파티클 시스템 상수 ---
const MAX_PARTICLES = 200;
const PARTICLE_LIFETIME = 0.8;
const PARTICLE_EMIT_RATE = 150;
const PARTICLE_SIZE = 0.8;
const PARTICLE_START_COLOR = new THREE.Color(0xffffaa);
const PARTICLE_END_COLOR = new THREE.Color(0xffaa00);
const PARTICLE_BASE_VELOCITY = -5;
const PARTICLE_VELOCITY_SPREAD = 2;
const PARTICLE_POSITION_SPREAD = 0.5;
// --- 색상 및 이름 상수 ---
const FIRST_PLACE_COLOR = new THREE.Color(0xffd700);
const SECOND_PLACE_COLOR = new THREE.Color(0xc0c0c0);
const THIRD_PLACE_COLOR = new THREE.Color(0xcd7f32);
const DEFAULT_LABEL_COLOR = new THREE.Color(0xffffff);
const MARKER_TEXT_COLOR = "rgba(200, 200, 200, 0.7)";
const NAME_PREFIXES = [
  "『해방된』",
  "『흉폭한』",
  "『재빠른』",
  "『부러진』",
  "『절름발이』",
  "『멋진』",
  "『못생긴』",
];
const NAME_SUFFIXES = [
  "호진",
  "승엽",
  "민재",
  "준호",
  "석희",
  "정환",
  "창완",
  "홍서",
  "연호",
  "선호",
  "세인",
];
// --- 알림 지속 시간 상수 ---
const KNOCK_BACK_NOTIFICATION_DURATION_CONST = 2.5;
const FIRST_TO_LAST_NOTIFICATION_DURATION_CONST = 3.0;
const SPEED_BOOST_NOTIFICATION_DURATION_CONST = 2.0;

// --- React 컴포넌트 정의 ---
function App() {
  // --- 상태 관리 ---
  const [numPlayers, setNumPlayers] = useState(20);
  const [playerNamesInput, setPlayerNamesInput] = useState("");
  const [validationError, setValidationError] = useState("");
  const [showSetup, setShowSetup] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [isRaceRunning, setIsRaceRunning] = useState(false);
  const [liveRanking, setLiveRanking] = useState({
    rank1: "---",
    rank2: "---",
    rank3: "---",
  });
  const [finalResults, setFinalResults] = useState({
    winner1: "---",
    winner2: "---",
    winner3: "---",
  });
  const [tooltip, setTooltip] = useState({
    visible: false,
    content: "",
    x: 0,
    y: 0,
  });
  const [isTimeFrozen, setIsTimeFrozen] = useState(false);
  const [freezeInfo, setFreezeInfo] = useState({
    freezerName: null,
    duration: 0,
    message: "",
  });
  const [isKnockBackActive, setIsKnockBackActive] = useState(false);
  const [knockBackInfo, setKnockBackInfo] = useState({
    actorName: null,
    message: "",
  });
  const [isFirstToLastActive, setIsFirstToLastActive] = useState(false);
  const [firstToLastInfo, setFirstToLastInfo] = useState({
    victimName: null,
    message: "",
  });
  const [isSpeedBoostActive, setIsSpeedBoostActive] = useState(false);
  const [speedBoostInfo, setSpeedBoostInfo] = useState({
    boosterName: null,
    message: "",
  });
  const [isRecordingAvailable, setIsRecordingAvailable] = useState(false);
  // const [isStarting, setIsStarting] = useState(false); // 필요하다면 시작 중 상태 추가

  // --- 참조 관리 ---
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
  const distanceMarkersRef = useRef([]);
  // 스킬 Refs
  const timeFreezerIdRef = useRef(null);
  const freezeStartTimeRef = useRef(null);
  const freezeDurationRef = useRef(0);
  const knockBackStartTimeRef = useRef(null);
  const knockBackDurationRef = useRef(KNOCK_BACK_NOTIFICATION_DURATION_CONST);
  const firstToLastStartTimeRef = useRef(null);
  const firstToLastDurationRef = useRef(
    FIRST_TO_LAST_NOTIFICATION_DURATION_CONST
  );
  const speedBoosterIdRef = useRef(null);
  const boostEndTimeRef = useRef(null);
  const boostNotifyStartTimeRef = useRef(null);
  const boostNotifyDurationRef = useRef(
    SPEED_BOOST_NOTIFICATION_DURATION_CONST
  );

  // --- 상태 설정 함수 참조 ---
  const liveRankingSetterRef = useRef(setLiveRanking);
  const finalResultsSetterRef = useRef(setFinalResults);
  const isRaceRunningSetterRef = useRef(setIsRaceRunning);
  const showResultsSetterRef = useRef(setShowResults);
  const isTimeFrozenSetterRef = useRef(setIsTimeFrozen);
  const freezeInfoSetterRef = useRef(setFreezeInfo);
  const isKnockBackActiveSetterRef = useRef(setIsKnockBackActive);
  const knockBackInfoSetterRef = useRef(setKnockBackInfo);
  const isFirstToLastActiveSetterRef = useRef(setIsFirstToLastActive);
  const firstToLastInfoSetterRef = useRef(setFirstToLastInfo);
  const isSpeedBoostActiveSetterRef = useRef(setIsSpeedBoostActive);
  const speedBoostInfoSetterRef = useRef(setSpeedBoostInfo);
  const isRecordingAvailableSetterRef = useRef(setIsRecordingAvailable);

  // --- 유틸리티 함수 ---
  // 파티클 시스템 생성 함수
  const createParticleSystem = useCallback(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const colors = new Float32Array(MAX_PARTICLES * 3);
    const alphas = new Float32Array(MAX_PARTICLES);
    const sizes = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      alphas[i] = 0.0;
      sizes[i] = PARTICLE_SIZE;
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geometry.drawRange.start = 0;
    geometry.drawRange.count = 0;
    const material = new THREE.PointsMaterial({
      size: PARTICLE_SIZE,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    points.visible = false;
    return { points, geometry, material };
  }, []);

  // 체크무늬 텍스처 생성 함수
  const createCheckerboardTexture = useCallback((widthToCover) => {
    const size = 16;
    const data = new Uint8Array(size * size * 3);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const iW = x % 4 < 2 !== y % 4 < 2;
        const c = iW ? 255 : 0;
        const s = (y * size + x) * 3;
        data[s] = data[s + 1] = data[s + 2] = c;
      }
    }
    const t = new THREE.DataTexture(data, size, size, THREE.RGBFormat);
    t.needsUpdate = true;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(widthToCover / 4, 1);
    return t;
  }, []);

  // 이름표 스프라이트 생성 함수
  const createNameLabel = useCallback((text) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const nameFontSize = 20;
    const speedFontSize = 16;
    const totalLineHeight = nameFontSize + speedFontSize + 4;
    const namePadding = 14;
    context.font = `Bold ${nameFontSize}px Arial`;
    const nameMetrics = context.measureText(text);
    let canvasWidth = nameMetrics.width + namePadding;
    const canvasHeight = totalLineHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = `Bold ${nameFontSize}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = "rgba(255, 255, 255, 0.95)";
    context.fillText(text, canvasWidth / 2, 3);
    context.font = `Normal ${speedFontSize}px Arial`;
    context.fillStyle = "rgba(200, 200, 200, 0.9)";
    context.fillText(`--- km/h`, canvasWidth / 2, nameFontSize + 6);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(
      LABEL_SCALE * (canvasWidth / canvasHeight),
      LABEL_SCALE,
      1
    );
    sprite.userData = {
      canvas,
      context,
      nameFontSize,
      speedFontSize,
      canvasWidth,
      canvasHeight,
    };
    return sprite;
  }, []);

  // 이름표 텍스처 업데이트 함수
  const updateNameLabel = (labelSprite, name, speedValue) => {
    if (!labelSprite || !labelSprite.userData.context) return;
    const { context, canvas, nameFontSize, speedFontSize, canvasHeight } =
      labelSprite.userData;
    let { canvasWidth } = labelSprite.userData;
    const speedText = `${speedValue.toFixed(0)} km/h`;
    context.font = `Bold ${nameFontSize}px Arial`;
    const nameMetrics = context.measureText(name);
    context.font = `Normal ${speedFontSize}px Arial`;
    const speedMetrics = context.measureText(speedText);
    const requiredWidth = Math.max(nameMetrics.width, speedMetrics.width) + 14;
    if (requiredWidth > canvas.width) {
      canvas.width = requiredWidth;
      labelSprite.userData.canvasWidth = requiredWidth;
      const aspectRatio = requiredWidth / canvasHeight;
      labelSprite.scale.set(LABEL_SCALE * aspectRatio, LABEL_SCALE, 1);
      canvasWidth = requiredWidth;
    }
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    context.font = `Bold ${nameFontSize}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = "rgba(255, 255, 255, 0.95)";
    context.fillText(name, canvasWidth / 2, 3);
    context.font = `Normal ${speedFontSize}px Arial`;
    context.fillStyle = "rgba(200, 200, 200, 0.9)";
    context.fillText(speedText, canvasWidth / 2, nameFontSize + 6);
    if (labelSprite.material.map) labelSprite.material.map.needsUpdate = true;
  };

  // 거리 마커 라벨 생성 함수
  const createDistanceMarkerLabel = useCallback((distance) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const fontSize = 24;
    const text = `${distance}m`;
    context.font = `Bold ${fontSize}px Arial`;
    const textMetrics = context.measureText(text);
    const canvasWidth = textMetrics.width + 10;
    const canvasHeight = fontSize + 8;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    context.font = `Bold ${fontSize}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = MARKER_TEXT_COLOR;
    context.fillText(text, canvasWidth / 2, canvasHeight / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      renderOrder: 1,
    });
    const sprite = new THREE.Sprite(material);
    const markerScale = 5.0;
    sprite.scale.set(
      markerScale * (canvasWidth / canvasHeight),
      markerScale,
      1
    );
    return sprite;
  }, []);

  // 랜덤 이름 생성 함수
  const generateRandomNames = useCallback((count) => {
    const names = new Set();
    while (names.size < count) {
      const prefix =
        NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
      const suffix =
        NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
      names.add(`${prefix} ${suffix}`);
    }
    let nameArray = Array.from(names);
    for (let i = nameArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nameArray[i], nameArray[j]] = [nameArray[j], nameArray[i]];
    }
    return nameArray.slice(0, count);
  }, []);

  // 레이서 제거 함수
  const clearRacers = useCallback(() => {
    if (!sceneRef.current) return;
    console.log("App: Clearing racers...");
    racersRef.current.forEach((racer) => {
      if (racer.mesh) {
        sceneRef.current.remove(racer.mesh);
        racer.mesh.geometry?.dispose();
        racer.mesh.material?.dispose();
      }
      if (racer.labelSprite) {
        sceneRef.current.remove(racer.labelSprite);
        racer.labelSprite.material?.map?.dispose();
        racer.labelSprite.material?.dispose();
      }
      if (racer.particleSystem) {
        sceneRef.current.remove(racer.particleSystem);
        racer.particleSystem.geometry?.dispose();
        racer.particleSystem.material?.dispose();
      }
    });
    racersRef.current = [];
    liveRankingSetterRef.current({ rank1: "---", rank2: "---", rank3: "---" });
    console.log("App: Racers cleared.");
  }, []);

  // 레이서 생성 함수
  const createRacers = useCallback(
    (currentNumPlayers, currentPlayerNames) => {
      if (!sceneRef.current || !cameraRef.current) {
        console.error("App: Cannot create racers: Scene or Camera not ready.");
        return;
      }
      clearRacers();
      console.log(`App: Creating ${currentNumPlayers} racers...`);
      const startLineZ = 0;
      const spacing =
        currentNumPlayers > 1 ? TRACK_WIDTH / currentNumPlayers : 0;
      const racerGeometry = new THREE.ConeGeometry(
        RACER_WIDTH,
        RACER_HEIGHT,
        16
      );
      racerGeometry.rotateX(Math.PI / 2);
      const baseMaterial = new THREE.MeshStandardMaterial({
        roughness: 0.4,
        metalness: 0.4,
      });
      const newRacers = [];
      for (let i = 0; i < currentNumPlayers; i++) {
        const racerMaterial = baseMaterial.clone();
        racerMaterial.color.setHSL(Math.random(), 0.7, 0.6);
        const racerMesh = new THREE.Mesh(racerGeometry, racerMaterial);
        const posX =
          currentNumPlayers > 1 ? -TRACK_WIDTH / 2 + spacing * (i + 0.5) : 0;
        const racerMeshYBase = RACER_HEIGHT / 4;
        racerMesh.position.set(posX, racerMeshYBase, startLineZ);
        racerMesh.castShadow = true;
        const playerName = currentPlayerNames[i];
        racerMesh.userData = { name: playerName };
        const labelSprite = createNameLabel(playerName);
        labelSprite.position.set(
          posX,
          racerMesh.position.y + LABEL_Y_OFFSET + 0.5,
          startLineZ
        );
        const {
          points: particleSystem,
          geometry: particleGeometry,
          material: particleMaterial,
        } = createParticleSystem();
        sceneRef.current.add(particleSystem);
        sceneRef.current.add(racerMesh);
        sceneRef.current.add(labelSprite);
        newRacers.push({
          id: i,
          mesh: racerMesh,
          labelSprite: labelSprite,
          name: playerName,
          speed: 0,
          displaySpeed: 0,
          targetZ: startLineZ,
          burstFactor: 1.0,
          bobOffset: Math.random() * Math.PI * 2,
          finishTime: -1,
          particleSystem: particleSystem,
          particleGeometry: particleGeometry,
          particleMaterial: particleMaterial,
          particlePool: Array(MAX_PARTICLES)
            .fill(null)
            .map(() => ({
              active: false,
              position: new THREE.Vector3(),
              velocity: new THREE.Vector3(),
              life: 0,
              startTime: 0,
              alpha: 0,
              size: 0,
              color: new THREE.Color(),
            })),
          activeParticleCount: 0,
          isBoosting: false,
        });
      }
      racersRef.current = newRacers;
      console.log("App: Racers created and added to scene.");
      if (cameraRef.current) {
        cameraRef.current.position.copy(initialCameraPosition);
        cameraRef.current.lookAt(0, 0, 0);
      }
      cameraTargetZRef.current = 0;
      liveRankingSetterRef.current({
        rank1: "---",
        rank2: "---",
        rank3: "---",
      });
    },
    [clearRacers, createNameLabel, createParticleSystem]
  );

  // --- 이벤트 핸들러 ---
  const handleNumPlayersChange = (event) =>
    setNumPlayers(parseInt(event.target.value, 10) || 0);
  const handleNamesChange = (event) => setPlayerNamesInput(event.target.value);
  const handleMouseMove = useCallback((event) => {
    if (!mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    clientMouseRef.current = { x: event.clientX, y: event.clientY };
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }, []);

  // *** 수정된 설정 및 레이스 시작 핸들러 ***
  const handleSetupAndStart = useCallback(async () => {
    // <<< async 추가
    console.log("App: Setup and Start button clicked.");
    // setIsStarting(true); // (선택) 시작 프로세스 시작 시 버튼 비활성화

    // 1. 레이스 진행 중인지 확인
    if (isRaceRunning || isRaceFinishedRef.current) {
      console.warn("App: Race is already running or finished.");
      // setIsStarting(false); // (선택)
      return;
    }

    // 2. 입력값 유효성 검사
    setValidationError("");
    const namesFromInput = playerNamesInput
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    let currentNumPlayers = numPlayers;
    let currentPlayerNames = [];

    if (namesFromInput.length > 0) {
      if (namesFromInput.length < 2) {
        setValidationError("참가자 이름은 최소 2명 이상 입력해야 합니다.");
        // setIsStarting(false); // (선택)
        return;
      }
      currentNumPlayers = namesFromInput.length;
      currentPlayerNames = namesFromInput;
      setNumPlayers(currentNumPlayers); // 참가자 수 상태 업데이트
    } else {
      if (isNaN(currentNumPlayers) || currentNumPlayers < 2) {
        setValidationError("참가자 수는 최소 2명 이상이어야 합니다.");
        // setIsStarting(false); // (선택)
        return;
      }
      currentPlayerNames = generateRandomNames(currentNumPlayers);
    }
    if (NUM_WINNERS > currentNumPlayers)
      console.warn("Warning: Number of winners > number of players.");

    // 3. 이전 녹화 상태 초기화
    VideoRecorder.discardRecording(); // 이전 데이터 폐기
    setIsRecordingAvailable(false); // 녹화 가능 상태 초기화
    console.log("App: Previous recording discarded (if any).");

    // 4. 녹화 여부 질문
    const wantsToRecord = window.confirm(
      "추첨 과정을 영상으로 녹화하시겠습니까?\n(녹화 선택 시 화면 공유 프롬프트에서 '이 탭 공유하기'를 선택해주세요.)"
    );

    let recordingSuccessfullyStarted = false;
    if (wantsToRecord) {
      // 5. 녹화 시작 시도 (getDisplayMedia 호출)
      alert(
        "화면 공유 선택 창이 나타납니다.\n가장 좋은 결과를 위해 [이 탭 공유하기] 또는 [현재 탭 공유]를 선택해주세요."
      );
      try {
        console.log(
          "App: Attempting to start video recording via getDisplayMedia..."
        );
        // startRecording은 Promise<boolean> 반환
        recordingSuccessfullyStarted = await VideoRecorder.startRecording(30); // 프레임 속도 지정 (선택사항)

        if (recordingSuccessfullyStarted) {
          console.log("App: Video recording initiated successfully.");
          // 녹화 성공 시 아래에서 레이스 시작 로직으로 넘어감
        } else {
          // 사용자가 취소했거나 권한 거부 또는 기타 사유로 시작 실패
          console.warn(
            "App: Video recording was not started (user cancellation or error). Race will not start."
          );
          alert(
            "화면 공유가 시작되지 않았습니다. 녹화 없이 진행하려면 다시 시도하여 '아니오'를 선택하세요."
          );
          // setIsStarting(false); // (선택)
          return; // 경주 시작 중단
        }
      } catch (error) {
        // startRecording 내부에서 예외 발생 시 (드문 경우)
        console.error(
          "App: Error occurred during VideoRecorder.startRecording:",
          error
        );
        alert(
          `녹화 시작 중 오류가 발생했습니다: ${error.message}. 경주를 시작할 수 없습니다.`
        );
        // setIsStarting(false); // (선택)
        return; // 경주 시작 중단
      }
    } else {
      // 사용자가 녹화를 원하지 않음
      console.log("App: User chose not to record. Starting race directly.");
      // 녹화 관련 작업 없이 아래 레이스 시작 로직으로 진행
    }

    // 6. 레이스 시작 공통 로직 (녹화 성공 or 녹화 안 함 선택 시 실행)
    console.log("App: Proceeding to start the race...");
    setShowSetup(false);
    setShowResults(false);
    isRaceFinishedRef.current = false;

    // 스킬 상태 초기화
    setIsTimeFrozen(false);
    setFreezeInfo({ freezerName: null, duration: 0, message: "" });
    timeFreezerIdRef.current = null;
    freezeStartTimeRef.current = null;
    freezeDurationRef.current = 0;
    setIsKnockBackActive(false);
    setKnockBackInfo({ actorName: null, message: "" });
    knockBackStartTimeRef.current = null;
    setIsFirstToLastActive(false);
    setFirstToLastInfo({ victimName: null, message: "" });
    firstToLastStartTimeRef.current = null;
    setIsSpeedBoostActive(false);
    setSpeedBoostInfo({ boosterName: null, message: "" });
    speedBoosterIdRef.current = null;
    boostEndTimeRef.current = null;
    boostNotifyStartTimeRef.current = null;
    console.log("App: Skill states reset.");

    // 레이서 생성
    createRacers(currentNumPlayers, currentPlayerNames);

    // 레이스 시작 상태 설정 및 애니메이션 루프 시작
    console.log(
      "App: Setting isRaceRunning to true to start animation loop..."
    );
    setIsRaceRunning(true);
    if (clockRef.current && !clockRef.current.running) {
      clockRef.current.start();
      console.log("App: Three.js clock started.");
    }
    // setIsStarting(false); // (선택) 시작 완료 후 버튼 활성화

    // *** 기존의 setTimeout으로 녹화 시작하는 부분은 제거됨 ***
  }, [
    // 의존성 배열: 필요한 상태와 함수 포함
    numPlayers,
    playerNamesInput,
    isRaceRunning,
    createRacers,
    generateRandomNames, // 기본 로직
    // 상태 setter는 일반적으로 ref를 통해 접근하므로 의존성 배열에 넣지 않아도 됨
  ]);

  // 새 추첨 준비 핸들러
  const prepareForNewSetup = useCallback(() => {
    console.log("App: Prepare for new setup clicked.");
    if (isRaceRunning) {
      console.warn("App: Cannot prepare new setup while race is running.");
      return;
    }
    // 진행 중인 녹화 중지 및 폐기 (stopRecording은 async이므로 Promise 처리)
    if (VideoRecorder.getIsRecording()) {
      console.log("App: Stopping active recording for new setup...");
      VideoRecorder.stopRecording()
        .then(() => {
          console.log("App: Active recording stopped for new setup.");
          VideoRecorder.discardRecording();
          setIsRecordingAvailable(false);
        })
        .catch((err) => {
          console.error("App: Error stopping recording during prepare:", err);
          VideoRecorder.discardRecording(); // 혹시 모르니 폐기 시도
          setIsRecordingAvailable(false);
        });
    } else {
      VideoRecorder.discardRecording(); // 녹화 데이터만 폐기
      setIsRecordingAvailable(false);
      console.log("App: Current recording data discarded for new setup.");
    }

    setShowResults(false);
    setShowSetup(true);
    clearRacers();
    if (cameraRef.current) {
      cameraRef.current.position.copy(initialCameraPosition);
      cameraRef.current.lookAt(0, 0, 0);
    }
    cameraTargetZRef.current = 0;
    isRaceFinishedRef.current = false;
    setIsRaceRunning(false);
    setValidationError("");
    setFinalResults({ winner1: "---", winner2: "---", winner3: "---" });
    // 스킬 상태 초기화
    setIsTimeFrozen(false);
    setFreezeInfo({
      /*...*/
    });
    timeFreezerIdRef.current = null; /*...*/
    setIsKnockBackActive(false);
    setKnockBackInfo({
      /*...*/
    });
    knockBackStartTimeRef.current = null; /*...*/
    setIsFirstToLastActive(false);
    setFirstToLastInfo({
      /*...*/
    });
    firstToLastStartTimeRef.current = null; /*...*/
    setIsSpeedBoostActive(false);
    setSpeedBoostInfo({
      /*...*/
    });
    speedBoosterIdRef.current = null; /*...*/
    console.log("App: Skill states reset for new setup.");
  }, [isRaceRunning, clearRacers]);

  // 레이스 종료 로직 (async/await 적용)
  const finishRace = useCallback(
    async () => {
      if (isRaceFinishedRef.current) return;
      console.log("App: Finishing race (async)...");
      isRaceFinishedRef.current = true;
      if (clockRef.current?.running) {
        clockRef.current.stop();
        console.log("App: Three.js clock stopped.");
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
        console.log("App: Animation frame cancelled on finishRace.");
      }

      // 비디오 녹화 중지 및 대기 (녹화 중이었다면)
      if (VideoRecorder.getIsRecording()) {
        try {
          console.log("App: Calling await VideoRecorder.stopRecording()...");
          await VideoRecorder.stopRecording(); // <<< 녹화 완료 대기
          console.log("App: VideoRecorder.stopRecording() promise resolved.");
          const hasData = VideoRecorder.hasRecordedData();
          isRecordingAvailableSetterRef.current(hasData); // <<< 완료 후 데이터 확인 및 상태 업데이트
          console.log(
            `App: Recording stopped confirmation. Data available: ${hasData}`
          );
        } catch (error) {
          console.error("App: Error during stopRecording:", error);
          isRecordingAvailableSetterRef.current(false);
          alert("녹화 중지 중 오류가 발생했습니다.");
        }
      } else {
        console.log("App: No active recording to stop.");
        // 녹화가 시작되지 않았거나 이미 중지된 경우, 데이터 유무만 체크할 수 있음
        const hasData = VideoRecorder.hasRecordedData();
        isRecordingAvailableSetterRef.current(hasData); // 이전에 폐기되지 않은 데이터가 있을 수도 있음
        console.log(
          `App: Checked for existing recording data. Available: ${hasData}`
        );
      }

      // 스킬 상태 초기화
      isTimeFrozenSetterRef.current(false);
      freezeInfoSetterRef.current({
        /*...*/
      });
      timeFreezerIdRef.current = null; /*...*/
      isKnockBackActiveSetterRef.current(false);
      knockBackInfoSetterRef.current({
        /*...*/
      });
      knockBackStartTimeRef.current = null; /*...*/
      isFirstToLastActiveSetterRef.current(false);
      firstToLastInfoSetterRef.current({
        /*...*/
      });
      firstToLastStartTimeRef.current = null; /*...*/
      isSpeedBoostActiveSetterRef.current(false);
      speedBoostInfoSetterRef.current({
        /*...*/
      });
      speedBoosterIdRef.current = null; /*...*/
      console.log("App: Skill states reset after race finish.");

      // 최종 순위 계산 및 결과 업데이트
      const finalRanking = [...racersRef.current]
        .filter((r) => r.finishTime >= 0)
        .sort((a, b) => a.finishTime - b.finishTime);
      finalResultsSetterRef.current({
        winner1: finalRanking[0]?.name || "---",
        winner2: finalRanking[1]?.name || "---",
        winner3: finalRanking[2]?.name || "---",
      });
      console.log(
        "App: Final results calculated:",
        finalRanking.slice(0, NUM_WINNERS).map((r) => r.name)
      );

      // 레이서 시각 효과 초기화
      racersRef.current.forEach((racer) => {
        if (racer.labelSprite.material)
          racer.labelSprite.material.color.set(DEFAULT_LABEL_COLOR);
        racer.isBoosting = false; // 부스트 효과 확실히 제거
      });

      // UI 업데이트
      showResultsSetterRef.current(true);
      isRaceRunningSetterRef.current(false);
      console.log(
        "App: Results screen shown, race running state set to false."
      );
    },
    [
      /* 의존성 배열: setter ref는 일반적으로 불필요 */
    ]
  );

  // 툴팁 업데이트 로직
  const updateTooltip = useCallback(() => {
    if (
      !mountRef.current ||
      !cameraRef.current ||
      !raycasterRef.current ||
      racersRef.current.length === 0
    ) {
      if (tooltip.visible) setTooltip((prev) => ({ ...prev, visible: false }));
      hoveredRacerRef.current = null;
      return;
    }
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const racerMeshes = racersRef.current.map((r) => r.mesh).filter(Boolean);
    if (racerMeshes.length === 0) return;
    const intersects = raycasterRef.current.intersectObjects(racerMeshes);
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      if (hoveredRacerRef.current !== intersectedObject || !tooltip.visible) {
        hoveredRacerRef.current = intersectedObject;
        const racerData = racersRef.current.find(
          (r) => r.mesh === hoveredRacerRef.current
        );
        setTooltip({
          visible: true,
          content: racerData?.name || "?",
          x: clientMouseRef.current.x + 15,
          y: clientMouseRef.current.y + 15,
        });
      } else {
        setTooltip((prev) => ({
          ...prev,
          x: clientMouseRef.current.x + 15,
          y: clientMouseRef.current.y + 15,
        }));
      }
    } else {
      if (hoveredRacerRef.current || tooltip.visible) {
        setTooltip((prev) => ({ ...prev, visible: false }));
      }
      hoveredRacerRef.current = null;
    }
  }, [tooltip.visible]);

  // 파티클 시스템 업데이트 함수
  const updateParticleSystem = useCallback((racer, deltaTime, elapsedTime) => {
    if (!racer.particleSystem || !racer.particleGeometry || !racer.particlePool)
      return;
    const geometry = racer.particleGeometry;
    const pool = racer.particlePool;
    const positions = geometry.attributes.position.array;
    const colors = geometry.attributes.color.array;
    const alphas = geometry.attributes.alpha.array;
    const sizes = geometry.attributes.size.array;
    let emitCount = racer.isBoosting
      ? Math.floor(PARTICLE_EMIT_RATE * deltaTime)
      : 0;
    let emittedThisFrame = 0;
    for (let i = 0; i < MAX_PARTICLES && emittedThisFrame < emitCount; i++) {
      if (pool[i] && !pool[i].active) {
        const p = pool[i];
        p.active = true;
        p.life = PARTICLE_LIFETIME;
        p.startTime = elapsedTime;
        p.position.copy(racer.mesh.position);
        p.position.z -= RACER_HEIGHT * 0.6;
        p.position.y -= RACER_HEIGHT * 0.1;
        p.position.x += (Math.random() - 0.5) * PARTICLE_POSITION_SPREAD;
        p.position.y += (Math.random() - 0.5) * PARTICLE_POSITION_SPREAD * 0.5;
        p.position.z += (Math.random() - 0.5) * PARTICLE_POSITION_SPREAD * 0.5;
        p.velocity.set(
          (Math.random() - 0.5) * PARTICLE_VELOCITY_SPREAD,
          (Math.random() - 0.5) * PARTICLE_VELOCITY_SPREAD,
          PARTICLE_BASE_VELOCITY +
            (Math.random() - 0.5) * PARTICLE_VELOCITY_SPREAD
        );
        p.color.copy(PARTICLE_START_COLOR);
        p.alpha = 1.0;
        p.size = PARTICLE_SIZE * (0.8 + Math.random() * 0.4);
        positions[i * 3 + 0] = p.position.x;
        positions[i * 3 + 1] = p.position.y;
        positions[i * 3 + 2] = p.position.z;
        colors[i * 3 + 0] = p.color.r;
        colors[i * 3 + 1] = p.color.g;
        colors[i * 3 + 2] = p.color.b;
        alphas[i] = p.alpha;
        sizes[i] = p.size;
        emittedThisFrame++;
      }
    }
    racer.activeParticleCount = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];
      if (p?.active) {
        p.life -= deltaTime;
        if (p.life <= 0) {
          p.active = false;
          alphas[i] = 0;
        } else {
          p.position.x += p.velocity.x * deltaTime;
          p.position.y += p.velocity.y * deltaTime;
          p.position.z += p.velocity.z * deltaTime;
          const lifeRatio = Math.max(0, p.life / PARTICLE_LIFETIME);
          p.alpha = lifeRatio * lifeRatio;
          p.size = PARTICLE_SIZE * lifeRatio * (0.8 + Math.random() * 0.4);
          p.color.lerpColors(
            PARTICLE_END_COLOR,
            PARTICLE_START_COLOR,
            lifeRatio * lifeRatio
          );
          positions[i * 3 + 0] = p.position.x;
          positions[i * 3 + 1] = p.position.y;
          positions[i * 3 + 2] = p.position.z;
          colors[i * 3 + 0] = p.color.r;
          colors[i * 3 + 1] = p.color.g;
          colors[i * 3 + 2] = p.color.b;
          alphas[i] = p.alpha;
          sizes[i] = p.size;
          racer.activeParticleCount++;
        }
      } else {
        if (alphas[i] !== 0) alphas[i] = 0;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    geometry.drawRange.count = racer.activeParticleCount;
    racer.particleSystem.visible = racer.activeParticleCount > 0;
  }, []);

  // 애니메이션 루프 함수
  const animate = useCallback(() => {
    if (
      !rendererRef.current ||
      !sceneRef.current ||
      !cameraRef.current ||
      !clockRef.current ||
      !racersRef.current
    ) {
      console.error("App: Animate loop aborted - missing essential refs.");
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
      return;
    }
    if (isRaceFinishedRef.current) {
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
      // finishRace가 호출되었으므로 여기서는 추가 중지 로직 불필요
      return;
    }

    const deltaTime = clockRef.current.getDelta();
    const elapsedTime = clockRef.current.getElapsedTime();
    if (deltaTime > 0.1)
      console.warn(`App/animate: Large deltaTime: ${deltaTime.toFixed(3)}s.`);

    let leadingZ = 0;
    let finishedCountInFrame = 0;
    const currentRacers = racersRef.current;

    // 스킬 이벤트 처리
    handleSkillEvents(
      elapsedTime,
      currentRacers,
      {
        timeFreezerIdRef,
        freezeStartTimeRef,
        freezeDurationRef,
        knockBackStartTimeRef,
        knockBackDurationRef,
        firstToLastStartTimeRef,
        firstToLastDurationRef,
        speedBoosterIdRef,
        boostEndTimeRef,
        boostNotifyStartTimeRef,
        boostNotifyDurationRef,
      },
      {
        isTimeFrozenSetterRef,
        freezeInfoSetterRef,
        isKnockBackActiveSetterRef,
        knockBackInfoSetterRef,
        isFirstToLastActiveSetterRef,
        firstToLastInfoSetterRef,
        isSpeedBoostActiveSetterRef,
        speedBoostInfoSetterRef,
      },
      isRaceFinishedRef.current
    );

    // 레이서 업데이트
    currentRacers.forEach((racer) => {
      const racerMeshYBase = RACER_HEIGHT / 4;
      const isRacerAlreadyFinished = racer.finishTime >= 0;
      const canMove =
        timeFreezerIdRef.current === null ||
        racer.id === timeFreezerIdRef.current;
      racer.isBoosting = speedBoosterIdRef.current === racer.id; // 매 프레임 부스트 상태 업데이트

      if (!isRacerAlreadyFinished) {
        if (canMove && deltaTime > 0) {
          let currentTargetSpeed =
            BASE_SPEED + (Math.random() - 0.5) * SPEED_VARIATION;
          let boostMultiplier = racer.isBoosting ? SPEED_BOOST_FACTOR : 1.0;
          currentTargetSpeed *= boostMultiplier;
          racer.burstFactor = 1.0;
          if (Math.random() < RANDOM_SPEED_BURST_CHANCE)
            racer.burstFactor = RANDOM_SPEED_BURST_FACTOR;
          else if (Math.random() < RANDOM_SLOWDOWN_CHANCE)
            racer.burstFactor = RANDOM_SLOWDOWN_FACTOR;
          racer.speed = Math.max(0.02, currentTargetSpeed) * racer.burstFactor;
          const deltaZ = racer.speed * (60 * deltaTime);
          racer.mesh.position.z += deltaZ;
          racer.displaySpeed =
            deltaZ > 0 && deltaTime > 0
              ? (deltaZ / deltaTime) * (SPEED_DISPLAY_SCALING_FACTOR / 60)
              : 0;

          if (racer.mesh.position.z >= RACE_DISTANCE) {
            racer.mesh.position.z = RACE_DISTANCE;
            racer.finishTime = elapsedTime;
            racer.mesh.position.y = racerMeshYBase;
            racer.labelSprite.position.y =
              racerMeshYBase + LABEL_Y_OFFSET + 0.5;
            racer.labelSprite.position.z = RACE_DISTANCE;
            racer.displaySpeed = 0;
            racer.isBoosting = false; // 도착 시 부스트 해제
          } else {
            const bobY =
              Math.sin(
                elapsedTime *
                  RACER_BOBBING_SPEED_FACTOR *
                  (0.8 + racer.speed * 0.5) +
                  racer.bobOffset
              ) * RACER_BOBBING_AMOUNT;
            racer.mesh.position.y = racerMeshYBase + bobY;
            racer.labelSprite.position.z = racer.mesh.position.z;
            racer.labelSprite.position.y =
              racer.mesh.position.y + LABEL_Y_OFFSET + 0.5;
          }
        } else {
          racer.displaySpeed = 0;
        } // 움직일 수 없을 때 속도 0
      } else {
        // 이미 도착한 레이서
        racer.displaySpeed = 0;
        racer.isBoosting = false; // 부스트 해제
        racer.mesh.position.z = RACE_DISTANCE;
        racer.labelSprite.position.z = RACE_DISTANCE;
        racer.mesh.position.y = racerMeshYBase;
        racer.labelSprite.position.y = racerMeshYBase + LABEL_Y_OFFSET + 0.5;
      }

      if (racer.finishTime >= 0) finishedCountInFrame++;
      updateNameLabel(racer.labelSprite, racer.name, racer.displaySpeed);
      updateParticleSystem(racer, deltaTime, elapsedTime); // 파티클 업데이트
      leadingZ = Math.max(leadingZ, racer.mesh.position.z);
    });

    // 실시간 순위 업데이트
    if (currentRacers.length > 0) {
      const sortedRacers = [...currentRacers].sort((a, b) => {
        if (b.mesh.position.z !== a.mesh.position.z)
          return b.mesh.position.z - a.mesh.position.z;
        if (a.finishTime >= 0 && b.finishTime >= 0)
          return a.finishTime - b.finishTime;
        if (a.finishTime >= 0) return -1;
        if (b.finishTime >= 0) return 1;
        return 0;
      });
      liveRankingSetterRef.current({
        rank1: sortedRacers[0]?.name || "---",
        rank2: sortedRacers[1]?.name || "---",
        rank3: sortedRacers[2]?.name || "---",
      });
      currentRacers.forEach((racer) => {
        const currentRank = sortedRacers.findIndex((sr) => sr.id === racer.id);
        let targetColor = DEFAULT_LABEL_COLOR;
        if (currentRank === 0) targetColor = FIRST_PLACE_COLOR;
        else if (currentRank === 1) targetColor = SECOND_PLACE_COLOR;
        else if (currentRank === 2) targetColor = THIRD_PLACE_COLOR;
        if (racer.labelSprite.material)
          racer.labelSprite.material.color.lerp(targetColor, 0.1);
      });
    }

    // 카메라 업데이트
    cameraTargetZRef.current = Math.max(0, leadingZ);
    const cameraZOffset =
      initialCameraPosition.z - Math.min(cameraTargetZRef.current * 0.03, 5);
    const targetCameraY =
      initialCameraPosition.y - Math.min(cameraTargetZRef.current * 0.02, 4);
    const wobbleX = Math.sin(elapsedTime * 0.7) * 0.4;
    if (cameraRef.current) {
      cameraRef.current.position.z = THREE.MathUtils.lerp(
        cameraRef.current.position.z,
        cameraTargetZRef.current + cameraZOffset,
        CAMERA_FOLLOW_LERP
      );
      cameraRef.current.position.y = THREE.MathUtils.lerp(
        cameraRef.current.position.y,
        targetCameraY,
        CAMERA_FOLLOW_LERP * 0.8
      );
      cameraRef.current.position.x = THREE.MathUtils.lerp(
        cameraRef.current.position.x,
        wobbleX,
        CAMERA_FOLLOW_LERP * 0.3
      );
      let lookAtTarget = new THREE.Vector3(0, -2, cameraTargetZRef.current + 5);
      cameraRef.current.lookAt(lookAtTarget);
    }

    // 모든 레이서 도착 시 레이스 종료
    if (
      finishedCountInFrame === currentRacers.length &&
      currentRacers.length > 0 &&
      !isRaceFinishedRef.current
    ) {
      console.log(
        `App/animate: All ${currentRacers.length} racers finished. Triggering finishRace...`
      );
      finishRace(); // async 함수 호출 (await 안함)
    }

    // 툴팁 및 렌더링
    updateTooltip();
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }

    // 다음 프레임 요청 (경주 종료되지 않았다면)
    if (!isRaceFinishedRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(animate);
    } else {
      animationFrameIdRef.current = null;
    }
  }, [
    finishRace,
    updateTooltip,
    updateNameLabel,
    updateParticleSystem,
    handleSkillEvents,
  ]); // 의존성 추가

  // --- useEffect: Three.js 초기화 및 정리 ---
  useEffect(() => {
    if (!mountRef.current) {
      console.error("App: Mount point not found.");
      return;
    }
    const currentMount = mountRef.current;
    let rendererInstance;
    console.log("App: Initializing Three.js scene...");
    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x1a1a2a);
    sceneRef.current.fog = new THREE.Fog(
      0x1a1a2a,
      RACE_DISTANCE * 0.5,
      RACE_DISTANCE * 1.5
    );
    const initialWidth = currentMount.clientWidth || window.innerWidth;
    const initialHeight = currentMount.clientHeight || window.innerHeight;
    cameraRef.current = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      initialWidth / initialHeight,
      0.1,
      1000
    );
    cameraRef.current.position.copy(initialCameraPosition);
    cameraRef.current.lookAt(0, 0, 0);
    try {
      // preserveDrawingBuffer는 이제 getDisplayMedia 사용 시 필요 없을 수 있음. 성능 고려 시 false로 변경 가능.
      rendererRef.current = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer: false,
      });
      rendererInstance = rendererRef.current;
      rendererRef.current.setPixelRatio(window.devicePixelRatio);
      rendererRef.current.shadowMap.enabled = true;
      rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;
      rendererRef.current.setSize(initialWidth, initialHeight);
      currentMount.appendChild(rendererRef.current.domElement);
      console.log("App: WebGL Renderer initialized.");
    } catch (error) {
      console.error("App: WebGL Renderer initialization failed:", error);
      setValidationError("WebGL 초기화 실패.");
      return;
    }

    clockRef.current = new THREE.Clock(false); // 자동 시작 안 함
    // 조명 설정
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, 50, -40);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = RACE_DISTANCE + 100;
    directionalLight.shadow.camera.left = -TRACK_WIDTH * 1.3;
    directionalLight.shadow.camera.right = TRACK_WIDTH * 1.3;
    directionalLight.shadow.camera.top = 70;
    directionalLight.shadow.camera.bottom = -70;
    sceneRef.current.add(directionalLight);
    const hemiLight = new THREE.HemisphereLight(0x446688, 0x112233, 0.3);
    sceneRef.current.add(hemiLight);
    // 트랙 및 결승선 설정
    const trackGeometry = new THREE.PlaneGeometry(
      TRACK_WIDTH * 1.8,
      RACE_DISTANCE * 1.6
    );
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x38384d,
      roughness: 0.9,
      metalness: 0.1,
    });
    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.rotation.x = -Math.PI / 2;
    track.position.y = -0.5;
    track.position.z = RACE_DISTANCE / 2 - 20;
    track.receiveShadow = true;
    sceneRef.current.add(track);
    const finishLineGeo = new THREE.PlaneGeometry(TRACK_WIDTH + 10, 3);
    const finishLineMat = new THREE.MeshBasicMaterial({
      map: createCheckerboardTexture(TRACK_WIDTH + 10),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
    finishLine.rotation.x = -Math.PI / 2;
    finishLine.position.set(0, -0.45, RACE_DISTANCE);
    sceneRef.current.add(finishLine);
    // 거리 마커 생성
    distanceMarkersRef.current = [];
    for (
      let dist = MARKER_INTERVAL;
      dist < RACE_DISTANCE;
      dist += MARKER_INTERVAL
    ) {
      const markerSprite = createDistanceMarkerLabel(dist);
      markerSprite.position.set(TRACK_WIDTH / 2 + 5, 1, dist);
      sceneRef.current.add(markerSprite);
      distanceMarkersRef.current.push(markerSprite);
    }
    // 리사이즈 핸들러
    const handleResize = () => {
      if (!rendererInstance || !cameraRef.current || !currentMount) return;
      const width = currentMount.clientWidth;
      const height = currentMount.clientHeight;
      if (width === 0 || height === 0) return;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererInstance.setSize(width, height);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    currentMount.addEventListener("mousemove", handleMouseMove);

    try {
      // 초기 렌더링
      if (rendererInstance && sceneRef.current && cameraRef.current) {
        rendererInstance.render(sceneRef.current, cameraRef.current);
        console.log("App: Initial scene rendered.");
      }
    } catch (error) {
      console.error("App: Initial render failed:", error);
    }

    // 정리 함수
    return () => {
      console.log("App: Cleaning up Three.js resources...");
      window.removeEventListener("resize", handleResize);
      if (currentMount)
        currentMount.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;

      // 녹화 정리 (진행 중이면 중지 및 폐기)
      if (VideoRecorder.getIsRecording()) {
        VideoRecorder.stopRecording().catch((err) =>
          console.warn("Cleanup: Error stopping recording:", err)
        );
      }
      VideoRecorder.discardRecording(); // 녹화 데이터 확실히 폐기
      setIsRecordingAvailable(false); // 상태 초기화
      console.log("App: Video recording stopped/discarded on cleanup.");

      // 마커 정리
      distanceMarkersRef.current.forEach((marker) => {
        sceneRef.current?.remove(marker);
        marker.material?.map?.dispose();
        marker.material?.dispose();
      });
      distanceMarkersRef.current = [];
      // 레이서 및 씬 요소 정리
      clearRacers();
      if (sceneRef.current) {
        sceneRef.current.remove(
          ambientLight,
          directionalLight,
          hemiLight,
          track,
          finishLine
        );
      }
      trackGeometry?.dispose();
      trackMaterial?.dispose();
      finishLineGeo?.dispose();
      finishLineMat?.map?.dispose();
      finishLineMat?.dispose();
      // 렌더러 정리
      if (rendererInstance) {
        rendererInstance.dispose();
        if (
          rendererInstance.domElement &&
          currentMount?.contains(rendererInstance.domElement)
        ) {
          try {
            currentMount.removeChild(rendererInstance.domElement);
          } catch (e) {
            console.warn("App: Error removing renderer DOM:", e);
          }
        }
        console.log("App: Renderer disposed.");
      }
      // Refs 초기화
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      clockRef.current = null;
      racersRef.current = [];
      console.log("App: Refs cleared.");
    };
  }, [
    // 초기화 관련 의존성
    createCheckerboardTexture,
    handleMouseMove,
    clearRacers,
    createNameLabel,
    createDistanceMarkerLabel,
    createParticleSystem,
  ]);

  // --- useEffect: 애니메이션 루프 시작/중지 제어 ---
  useEffect(() => {
    if (isRaceRunning) {
      console.log(
        "App: useEffect[isRaceRunning]: Race started, starting animation loop."
      );
      isRaceFinishedRef.current = false; // 시작 시 항상 false
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current); // 중복 방지
      animationFrameIdRef.current = requestAnimationFrame(animate);
    } else {
      // isRaceRunning이 false일 때 (초기 상태, 레이스 종료 후 등)
      if (animationFrameIdRef.current) {
        console.log(
          "App: useEffect[isRaceRunning]: Race stopped or not started, cancelling animation frame."
        );
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      // 레이스가 명시적으로 종료된 것이 아니라 isRaceRunning만 false가 되었을 때
      // (예: prepareForNewSetup 호출 시) 녹화 중단 로직은 prepareForNewSetup에서 처리.
      // finishRace 호출 시 녹화 중단은 finishRace 내부에서 처리.
    }
    // 컴포넌트 언마운트 또는 isRaceRunning 변경 시 cleanup
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [isRaceRunning, animate]); // isRaceRunning 변경 시 실행

  // --- useEffect: 상태 설정 함수 참조 업데이트 ---
  useEffect(() => {
    // 매 렌더링 후 setter ref 업데이트 (상태 변경 시 콜백에서 최신 setter 사용 목적)
    liveRankingSetterRef.current = setLiveRanking;
    finalResultsSetterRef.current = setFinalResults;
    isRaceRunningSetterRef.current = setIsRaceRunning;
    showResultsSetterRef.current = setShowResults;
    isTimeFrozenSetterRef.current = setIsTimeFrozen;
    freezeInfoSetterRef.current = setFreezeInfo;
    isKnockBackActiveSetterRef.current = setIsKnockBackActive;
    knockBackInfoSetterRef.current = setKnockBackInfo;
    isFirstToLastActiveSetterRef.current = setIsFirstToLastActive;
    firstToLastInfoSetterRef.current = setFirstToLastInfo;
    isSpeedBoostActiveSetterRef.current = setIsSpeedBoostActive;
    speedBoostInfoSetterRef.current = setSpeedBoostInfo;
    isRecordingAvailableSetterRef.current = setIsRecordingAvailable;
  }); // 의존성 배열 없음: 매 렌더링마다 실행

  // --- 비디오 저장 버튼 클릭 핸들러 ---
  const handleSaveVideo = () => {
    console.log("App: Save video button clicked.");
    if (!VideoRecorder.hasRecordedData()) {
      console.warn("App: No recorded data to save.");
      alert("저장할 녹화 영상 데이터가 없습니다.");
      setIsRecordingAvailable(false); // 확실하게 비활성화
      return;
    }
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.T-]/g, "")
      .substring(0, 14);
    const baseFilename = `RandomRacer_${timestamp}`; // 확장자 제외
    VideoRecorder.saveRecording(baseFilename); // videoRecorder가 확장자(.mp4 또는 .webm) 결정
    setIsRecordingAvailable(false); // 저장 시도 후 비활성화
  };

  // --- JSX 렌더링 구조 ---
  return (
    <div className="app-container">
      {/* 설정 오버레이 */}
      <div className={`overlay setup-overlay ${showSetup ? "" : "hidden"}`}>
        <h1>랜덤 레이서 추첨</h1>
        <div className="input-group">
          <label htmlFor="numPlayersInput">참가자 수:</label>
          <input
            id="numPlayersInput"
            type="number"
            value={numPlayers}
            onChange={handleNumPlayersChange}
            min="2"
            disabled={isRaceRunning /*|| isStarting*/}
          />
        </div>
        <div className="input-group">
          <label htmlFor="playerNamesInput">참가자 이름:</label>
          <textarea
            id="playerNamesInput"
            rows="5"
            placeholder="(한 줄에 한 명 / 미 입력 시 랜덤)"
            value={playerNamesInput}
            onChange={handleNamesChange}
            disabled={isRaceRunning /*|| isStarting*/}
          />
        </div>
        <button
          id="startButton"
          className="action-button"
          onClick={handleSetupAndStart}
          disabled={isRaceRunning /*|| isStarting*/} // 레이스 진행 중 비활성화
        >
          {isRaceRunning ? "추첨 진행 중..." : "설정 및 추첨 시작!"}
        </button>
        <p className="error-message">{validationError}</p>
      </div>

      {/* 결과 오버레이 */}
      <div className={`overlay results-overlay ${showResults ? "" : "hidden"}`}>
        <h2>추첨 결과!</h2>
        <div className="winner-list">
          <p>
            🥇 <span id="winner1">{finalResults.winner1}</span>
          </p>
          <p>
            🥈 <span id="winner2">{finalResults.winner2}</span>
          </p>
          <p>
            🥉 <span id="winner3">{finalResults.winner3}</span>
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            margin: "15px 0",
          }}
        >
          <button
            className="restart-button"
            onClick={() => alert("카카오톡 공유 기능은 구현되지 않았습니다.")}
          >
            카카오톡 공유
          </button>
          <button
            className="restart-button"
            onClick={handleSaveVideo}
            disabled={!isRecordingAvailable}
          >
            영상 저장 {isRecordingAvailable ? "" : "(녹화 없음)"}
          </button>
        </div>
        <button
          id="restartButton"
          className="restart-button"
          onClick={prepareForNewSetup}
          disabled={isRaceRunning}
        >
          새 추첨 설정
        </button>
        <p>
          <small>('새 추첨 설정'을 클릭하여 다시 시작)</small>
        </p>
      </div>

      {/* 실시간 순위 */}
      <div className={`live-ranking ${isRaceRunning ? "visible" : ""}`}>
        <h3>실시간 순위</h3>
        <p>
          1st: <span id="rank1">{liveRanking.rank1}</span>
        </p>
        <p>
          2nd: <span id="rank2">{liveRanking.rank2}</span>
        </p>
        <p>
          3rd: <span id="rank3">{liveRanking.rank3}</span>
        </p>
      </div>

      {/* 스킬 알림 */}
      <div className={`time-freeze-notice ${isTimeFrozen ? "visible" : ""}`}>
        {freezeInfo.message}
      </div>
      <div
        className={`knock-back-notice ${isKnockBackActive ? "visible" : ""}`}
      >
        {knockBackInfo.message}
      </div>
      <div
        className={`first-to-last-notice ${
          isFirstToLastActive ? "visible" : ""
        }`}
      >
        {firstToLastInfo.message}
      </div>
      <div
        className={`speed-boost-notice ${isSpeedBoostActive ? "visible" : ""}`}
      >
        {speedBoostInfo.message}
      </div>

      {/* 3D 캔버스 */}
      <div ref={mountRef} className="three-mount"></div>

      {/* 툴팁 */}
      <div
        className={`tooltip ${tooltip.visible ? "visible" : ""}`}
        style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
      >
        {tooltip.content}
      </div>
    </div>
  );
}

export default App;
