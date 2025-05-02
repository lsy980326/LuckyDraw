// src/App.js (or App.jsx)

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import "./App.css"; // CSS 파일 import
import { handleSkillEvents, SPEED_BOOST_FACTOR } from "./skills"; // 스킬 핸들러 및 상수 import

// --- 환경 설정 상수 ---
const NUM_WINNERS = 3; // 최종 결과에 표시할 우승자 수
const RACE_DISTANCE = 200; // << 변경됨: 경주 거리 200m
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
const MARKER_INTERVAL = 50; // << 추가됨: 거리 표시 마커 간격 (m)
const SPEED_DISPLAY_SCALING_FACTOR = 180; // << 추가됨: 속도 표시 값 조절 계수
// --- 파티클 시스템 상수 ---
const MAX_PARTICLES = 200; // 레이서당 최대 파티클 수
const PARTICLE_LIFETIME = 0.8; // 파티클 수명 (초)
const PARTICLE_EMIT_RATE = 150; // 초당 파티클 생성 개수
const PARTICLE_SIZE = 0.8; // 파티클 크기
const PARTICLE_START_COLOR = new THREE.Color(0xffffaa); // 시작 색상 (밝은 노랑)
const PARTICLE_END_COLOR = new THREE.Color(0xffaa00); // 끝 색상 (주황)
const PARTICLE_BASE_VELOCITY = -5; // 파티클 기본 후방 속도
const PARTICLE_VELOCITY_SPREAD = 2; // 속도 무작위 범위
const PARTICLE_POSITION_SPREAD = 0.5; // 생성 위치 무작위 범위
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
// 알림 지속 시간 상수
const KNOCK_BACK_NOTIFICATION_DURATION_CONST = 2.5;
const FIRST_TO_LAST_NOTIFICATION_DURATION_CONST = 3.0;
const SPEED_BOOST_NOTIFICATION_DURATION_CONST = 2.0; // Speed boost 알림 시간

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
  // 스킬 상태
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
  const [isSpeedBoostActive, setIsSpeedBoostActive] = useState(false); // << 부스트 알림 상태
  const [speedBoostInfo, setSpeedBoostInfo] = useState({
    boosterName: null,
    message: "",
  }); // << 부스트 알림 정보

  // --- 참조 관리 ---
  const mountRef = useRef(null); // 캔버스 마운트 지점
  const rendererRef = useRef(null); // Three.js 렌더러
  const sceneRef = useRef(null); // Three.js 씬
  const cameraRef = useRef(null); // Three.js 카메라
  const clockRef = useRef(null); // Three.js 시계
  const racersRef = useRef([]); // 레이서 데이터 배열
  const animationFrameIdRef = useRef(null); // 애니메이션 프레임 ID
  const mouseRef = useRef(new THREE.Vector2()); // 정규화된 마우스 좌표
  const clientMouseRef = useRef({ x: 0, y: 0 }); // 뷰포트 마우스 좌표
  const raycasterRef = useRef(new THREE.Raycaster()); // 마우스 클릭/호버 감지용
  const hoveredRacerRef = useRef(null); // 현재 호버된 레이서
  const cameraTargetZRef = useRef(0); // 카메라 목표 Z 위치
  const isRaceFinishedRef = useRef(false); // 레이스 종료 플래그
  const distanceMarkersRef = useRef([]); // << 추가됨: 거리 마커 객체 배열
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
  const speedBoosterIdRef = useRef(null); // << 부스트 효과 받는 레이서 ID Ref
  const boostEndTimeRef = useRef(null); // << 부스트 효과 종료 시간 Ref
  const boostNotifyStartTimeRef = useRef(null); // << 부스트 알림 시작 시간 Ref
  const boostNotifyDurationRef = useRef(
    SPEED_BOOST_NOTIFICATION_DURATION_CONST
  ); // << 부스트 알림 지속 시간 Ref

  // --- 상태 설정 함수 참조 ---
  const liveRankingSetterRef = useRef(setLiveRanking);
  const finalResultsSetterRef = useRef(setFinalResults);
  const isRaceRunningSetterRef = useRef(setIsRaceRunning);
  const showResultsSetterRef = useRef(setShowResults);
  // 스킬 Setter Refs
  const isTimeFrozenSetterRef = useRef(setIsTimeFrozen);
  const freezeInfoSetterRef = useRef(setFreezeInfo);
  const isKnockBackActiveSetterRef = useRef(setIsKnockBackActive);
  const knockBackInfoSetterRef = useRef(setKnockBackInfo);
  const isFirstToLastActiveSetterRef = useRef(setIsFirstToLastActive);
  const firstToLastInfoSetterRef = useRef(setFirstToLastInfo);
  const isSpeedBoostActiveSetterRef = useRef(setIsSpeedBoostActive); // << 부스트 알림 Setter Ref
  const speedBoostInfoSetterRef = useRef(setSpeedBoostInfo); // << 부스트 알림 정보 Setter Ref

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
    } // 초기화
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
  }, []); // 의존성 없음

  // 체크무늬 텍스처 생성
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

  // 이름표 스프라이트 생성 (속도 표시 공간 포함)
  const createNameLabel = useCallback((text) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const nameFontSize = 20; // 이름 폰트 크기
    const speedFontSize = 16; // 속도 폰트 크기 (이름보다 작게)
    const totalLineHeight = nameFontSize + speedFontSize + 4; // 이름 + 속도 + 상하 패딩 고려한 높이
    const namePadding = 14; // 이름 좌우 패딩

    context.font = `Bold ${nameFontSize}px Arial`;
    const nameMetrics = context.measureText(text);
    let canvasWidth = nameMetrics.width + namePadding; // 초기 너비
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
    sprite.userData.canvas = canvas;
    sprite.userData.context = context;
    sprite.userData.nameFontSize = nameFontSize;
    sprite.userData.speedFontSize = speedFontSize;
    sprite.userData.canvasWidth = canvasWidth;
    sprite.userData.canvasHeight = canvasHeight;
    return sprite;
  }, []); // 의존성 없음

  // 이름표 텍스처 업데이트 함수 (이름과 속도 다시 그리기)
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
    if (labelSprite.material.map) {
      labelSprite.material.map.needsUpdate = true;
    }
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

  // 레이서 제거 (파티클 시스템 정리 추가)
  const clearRacers = useCallback(() => {
    if (!sceneRef.current) return;
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
        // 파티클 정리
        sceneRef.current.remove(racer.particleSystem);
        racer.particleSystem.geometry?.dispose();
        racer.particleSystem.material?.dispose();
      }
    });
    racersRef.current = [];
    liveRankingSetterRef.current({ rank1: "---", rank2: "---", rank3: "---" });
  }, []); // 의존성 없음

  // 레이서 생성 (파티클 시스템 생성 및 저장 추가)
  const createRacers = useCallback(
    (currentNumPlayers, currentPlayerNames) => {
      if (!sceneRef.current || !cameraRef.current) return;
      clearRacers();
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
      console.log("레이서 생성 및 씬 추가 완료.");
      cameraRef.current.position.copy(initialCameraPosition);
      cameraRef.current.lookAt(0, 0, 0);
      cameraTargetZRef.current = 0;
      liveRankingSetterRef.current({
        rank1: "---",
        rank2: "---",
        rank3: "---",
      });
    },
    [clearRacers, createNameLabel, createParticleSystem] // createParticleSystem 의존성 추가
  );

  // 랜덤 이름 생성 (변경 없음)
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

  // --- 이벤트 핸들러 (스킬 리셋 부분 확인) ---
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

  // 설정 및 시작 핸들러 (모든 스킬 상태 리셋 추가됨)
  const handleSetupAndStart = useCallback(() => {
    if (isRaceRunning || isRaceFinishedRef.current) return;
    setValidationError("");
    const namesFromInput = playerNamesInput
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    let currentNumPlayers = numPlayers;
    let currentPlayerNames = [];
    if (namesFromInput.length > 0) {
      if (namesFromInput.length < 2) {
        setValidationError("최소 2명 이상");
        return;
      }
      currentNumPlayers = namesFromInput.length;
      currentPlayerNames = namesFromInput;
      setNumPlayers(currentNumPlayers);
    } else {
      if (isNaN(currentNumPlayers) || currentNumPlayers < 2) {
        setValidationError("참가자 수 2명 이상");
        return;
      }
      currentPlayerNames = generateRandomNames(currentNumPlayers);
    }
    if (NUM_WINNERS > currentNumPlayers) console.warn("우승자 수 > 참가자 수");

    setShowSetup(false);
    setShowResults(false);
    isRaceFinishedRef.current = false;

    // *** 모든 스킬 상태 및 Refs 초기화 ***
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
    boostNotifyStartTimeRef.current = null; // << 부스트 리셋

    createRacers(currentNumPlayers, currentPlayerNames);
    setIsRaceRunning(true);
    if (clockRef.current) clockRef.current.start();
  }, [
    numPlayers,
    playerNamesInput,
    isRaceRunning,
    createRacers,
    generateRandomNames,
  ]);

  // 새 추첨 준비 핸들러 (모든 스킬 상태 리셋 추가됨)
  const prepareForNewSetup = useCallback(() => {
    if (isRaceRunning) return;
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

    // *** 모든 스킬 상태 및 Refs 초기화 ***
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
    boostNotifyStartTimeRef.current = null; // << 부스트 리셋
  }, [isRaceRunning, clearRacers]);

  // 레이스 종료 로직 (모든 스킬 상태 리셋 추가됨)
  const finishRace = useCallback(() => {
    if (isRaceFinishedRef.current) return;
    isRaceFinishedRef.current = true;
    if (clockRef.current) clockRef.current.stop();

    // *** 모든 스킬 상태 Setter Refs를 통해 상태 리셋 ***
    isTimeFrozenSetterRef.current(false);
    freezeInfoSetterRef.current({
      freezerName: null,
      duration: 0,
      message: "",
    });
    timeFreezerIdRef.current = null;
    freezeStartTimeRef.current = null;
    freezeDurationRef.current = 0;
    isKnockBackActiveSetterRef.current(false);
    knockBackInfoSetterRef.current({ actorName: null, message: "" });
    knockBackStartTimeRef.current = null;
    isFirstToLastActiveSetterRef.current(false);
    firstToLastInfoSetterRef.current({ victimName: null, message: "" });
    firstToLastStartTimeRef.current = null;
    isSpeedBoostActiveSetterRef.current(false);
    speedBoostInfoSetterRef.current({ boosterName: null, message: "" });
    speedBoosterIdRef.current = null;
    boostEndTimeRef.current = null;
    boostNotifyStartTimeRef.current = null; // << 부스트 리셋

    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    const finalRanking = [...racersRef.current]
      .filter((r) => r.finishTime >= 0)
      .sort((a, b) => a.finishTime - b.finishTime);
    finalResultsSetterRef.current({
      winner1: finalRanking[0]?.name || "---",
      winner2: finalRanking[1]?.name || "---",
      winner3: finalRanking[2]?.name || "---",
    });
    racersRef.current.forEach((racer) => {
      if (racer.labelSprite.material)
        racer.labelSprite.material.color.set(DEFAULT_LABEL_COLOR);
      racer.isBoosting = false; /* 종료 시 부스트 상태 해제 */
    });
    showResultsSetterRef.current(true);
    isRaceRunningSetterRef.current(false);
  }, []);

  // 툴팁 업데이트 로직 (변경 없음)
  const updateTooltip = useCallback(() => {
    if (
      !mountRef.current ||
      !cameraRef.current ||
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
      if (hoveredRacerRef.current)
        setTooltip((prev) => ({ ...prev, visible: false }));
      hoveredRacerRef.current = null;
    }
  }, [tooltip.visible]);

  // 파티클 시스템 업데이트 헬퍼 함수
  const updateParticleSystem = useCallback((racer, deltaTime, elapsedTime) => {
    if (!racer.particleSystem || !racer.particleGeometry) return;
    const geometry = racer.particleGeometry;
    const pool = racer.particlePool;
    const positions = geometry.attributes.position.array;
    const colors = geometry.attributes.color.array;
    const alphas = geometry.attributes.alpha.array;
    const sizes = geometry.attributes.size.array;
    let emitCount = 0;
    if (racer.isBoosting) {
      emitCount = Math.floor(PARTICLE_EMIT_RATE * deltaTime);
    } // 부스트 상태일 때만 생성
    let emittedThisFrame = 0;
    for (let i = 0; i < MAX_PARTICLES && emittedThisFrame < emitCount; i++) {
      if (!pool[i]?.active) {
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
      } // 비활성 투명 처리
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
    geometry.attributes.size.needsUpdate = true;
    geometry.drawRange.count = racer.activeParticleCount;
    racer.particleSystem.visible = racer.activeParticleCount > 0;
  }, []); // 의존성 없음

  // --- 애니메이션 루프 함수 ---
  const animate = useCallback(() => {
    if (
      !rendererRef.current ||
      !sceneRef.current ||
      !cameraRef.current ||
      !clockRef.current ||
      !racersRef.current
    )
      return;
    if (isRaceFinishedRef.current) {
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
      return;
    }

    const deltaTime = clockRef.current.getDelta();
    const elapsedTime = clockRef.current.getElapsedTime();
    let leadingZ = 0;
    let activeRacersCount = 0;
    const currentRacers = racersRef.current;

    // 스킬 이벤트 처리 (skills.js 호출)
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
      }, // << 모든 스킬 ref 전달
      {
        isTimeFrozenSetterRef,
        freezeInfoSetterRef,
        isKnockBackActiveSetterRef,
        knockBackInfoSetterRef,
        isFirstToLastActiveSetterRef,
        firstToLastInfoSetterRef,
        isSpeedBoostActiveSetterRef,
        speedBoostInfoSetterRef,
      }, // << 모든 스킬 setter ref 전달
      isRaceFinishedRef.current
    );

    // 레이서 업데이트
    currentRacers.forEach((racer) => {
      const racerMeshYBase = RACER_HEIGHT / 4;
      const isRacerFinished = racer.mesh.position.z >= RACE_DISTANCE;
      const canMove =
        timeFreezerIdRef.current === null ||
        racer.id === timeFreezerIdRef.current;
      let deltaZ = 0;

      // isBoosting 플래그 업데이트 (skills.js에서 설정한 speedBoosterIdRef 확인)
      racer.isBoosting = speedBoosterIdRef.current === racer.id;

      if (!isRacerFinished) {
        activeRacersCount++;
        if (canMove) {
          // 속도 계산 (부스트 팩터 적용)
          let currentTargetSpeed =
            BASE_SPEED + (Math.random() - 0.5) * SPEED_VARIATION;
          let boostMultiplier = 1.0;
          if (racer.isBoosting) {
            boostMultiplier = SPEED_BOOST_FACTOR;
          } // skills.js에서 export한 상수 사용
          currentTargetSpeed *= boostMultiplier; // 부스트 적용

          racer.burstFactor = 1.0; /* Burst/Slowdown 적용 */
          if (Math.random() < RANDOM_SPEED_BURST_CHANCE)
            racer.burstFactor = RANDOM_SPEED_BURST_FACTOR;
          else if (Math.random() < RANDOM_SLOWDOWN_CHANCE)
            racer.burstFactor = RANDOM_SLOWDOWN_FACTOR;
          racer.speed = Math.max(0.02, currentTargetSpeed) * racer.burstFactor;
          deltaZ = racer.speed * (60 * deltaTime);

          racer.displaySpeed =
            (deltaZ / deltaTime) * (SPEED_DISPLAY_SCALING_FACTOR / 60);

          // 위치 업데이트 및 도착 체크
          racer.mesh.position.z += deltaZ;
          if (racer.mesh.position.z >= RACE_DISTANCE) {
            // 도착 처리
            racer.mesh.position.z = RACE_DISTANCE;
            if (racer.finishTime < 0) racer.finishTime = elapsedTime;
            racer.mesh.position.y = racerMeshYBase;
            racer.labelSprite.position.y =
              racerMeshYBase + LABEL_Y_OFFSET + 0.5;
            racer.labelSprite.position.z = RACE_DISTANCE;
            racer.displaySpeed = 0;
            racer.isBoosting = false;
          } else {
            // 경주 중: 바빙, 라벨 위치
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
          deltaZ = 0;
        } // 시간 멈춤
      } else {
        // 이미 도착
        racer.displaySpeed = 0;
        racer.isBoosting = false;
        racer.mesh.position.z = RACE_DISTANCE;
        racer.labelSprite.position.z = RACE_DISTANCE;
        racer.mesh.position.y = racerMeshYBase;
        racer.labelSprite.position.y = racerMeshYBase + LABEL_Y_OFFSET + 0.5;
      }

      // 라벨 업데이트
      updateNameLabel(racer.labelSprite, racer.name, racer.displaySpeed);
      // 파티클 시스템 업데이트 호출
      updateParticleSystem(racer, deltaTime, elapsedTime);
      // 선두 주자 Z 업데이트
      leadingZ = Math.max(leadingZ, racer.mesh.position.z);
    });

    // 실시간 순위 및 색상 업데이트
    if (currentRacers.length > 0) {
      const sortedRacers = [...currentRacers].sort((a, b) => {
        if (b.mesh.position.z !== a.mesh.position.z)
          return b.mesh.position.z - a.mesh.position.z;
        if (a.finishTime < 0 && b.finishTime < 0) return 0;
        if (a.finishTime < 0) return 1;
        if (b.finishTime < 0) return -1;
        return a.finishTime - b.finishTime;
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
    if (cameraRef.current) {
      cameraRef.current.position.z = THREE.MathUtils.lerp(
        cameraRef.current.position.z,
        cameraTargetZRef.current + cameraZOffset,
        CAMERA_FOLLOW_LERP
      );
      const targetCameraY =
        initialCameraPosition.y - Math.min(cameraTargetZRef.current * 0.02, 4);
      cameraRef.current.position.y = THREE.MathUtils.lerp(
        cameraRef.current.position.y,
        targetCameraY,
        CAMERA_FOLLOW_LERP * 0.8
      );
      let lookAtTarget = new THREE.Vector3(0, -2, cameraTargetZRef.current + 5);
      const wobbleX = Math.sin(elapsedTime * 0.7) * 0.4;
      cameraRef.current.position.x = THREE.MathUtils.lerp(
        cameraRef.current.position.x,
        wobbleX,
        CAMERA_FOLLOW_LERP * 0.3
      );
      cameraRef.current.lookAt(lookAtTarget);
    }
    // 종료 조건 확인
    if (
      activeRacersCount === 0 &&
      currentRacers.length > 0 &&
      !isRaceFinishedRef.current
    ) {
      finishRace();
    }
    updateTooltip();
    // 렌더링
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
    // 다음 프레임 요청
    if (!isRaceFinishedRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
  }, [finishRace, updateTooltip, updateNameLabel, updateParticleSystem]); // updateParticleSystem 의존성 추가

  // --- useEffect: Three.js 초기화 및 정리 (거리 마커 추가, 마커 정리 추가) ---
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;
    let rendererInstance;
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
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      rendererInstance = rendererRef.current;
      rendererRef.current.setPixelRatio(window.devicePixelRatio);
      rendererRef.current.shadowMap.enabled = true;
      rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap;
      currentMount.appendChild(rendererRef.current.domElement);
      rendererRef.current.setSize(initialWidth, initialHeight);
    } catch (error) {
      setValidationError("WebGL 초기화 실패.");
      return;
    }
    clockRef.current = new THREE.Clock(false);
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    sceneRef.current.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(5, 50, -40);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -TRACK_WIDTH * 1.3;
    directionalLight.shadow.camera.right = TRACK_WIDTH * 1.3;
    directionalLight.shadow.camera.top = 70;
    directionalLight.shadow.camera.bottom = -70;
    sceneRef.current.add(directionalLight);
    const hemiLight = new THREE.HemisphereLight(0x446688, 0x112233, 0.3);
    sceneRef.current.add(hemiLight);
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

    // --- 거리 마커 생성 및 추가 ---
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

    // --- 이벤트 리스너 및 초기 렌더링 ---
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
      if (rendererInstance && sceneRef.current && cameraRef.current)
        rendererInstance.render(sceneRef.current, cameraRef.current);
    } catch (error) {
      console.error("초기 렌더링 중 오류:", error);
    }

    // --- 클린업 함수 ---
    return () => {
      window.removeEventListener("resize", handleResize);
      if (currentMount)
        currentMount.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      // 거리 마커 정리
      distanceMarkersRef.current.forEach((marker) => {
        sceneRef.current?.remove(marker);
        marker.material?.map?.dispose();
        marker.material?.dispose();
      });
      distanceMarkersRef.current = [];
      clearRacers(); // 레이서 정리 (파티클 포함)
      // 나머지 씬 객체 정리
      sceneRef.current?.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((m) => {
              m.map?.dispose();
              m.dispose();
            });
          } else {
            object.material.map?.dispose();
            object.material.dispose();
          }
        }
        object.texture?.dispose();
      });
      // 렌더러 정리
      if (rendererInstance) {
        rendererInstance.dispose();
        if (
          rendererInstance.domElement &&
          currentMount?.contains(rendererInstance.domElement)
        ) {
          try {
            currentMount.removeChild(rendererInstance.domElement);
          } catch (e) {}
        }
      }
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      clockRef.current = null;
      racersRef.current = [];
    };
  }, [
    createCheckerboardTexture,
    handleMouseMove,
    clearRacers,
    createNameLabel,
    createDistanceMarkerLabel,
    createParticleSystem,
  ]); // createParticleSystem 의존성 추가

  // --- useEffect: 애니메이션 루프 시작/중지 ---
  useEffect(() => {
    if (isRaceRunning) {
      isRaceFinishedRef.current = false;
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
    return () => {
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    };
  }, [isRaceRunning, animate]);

  // --- useEffect: 상태 설정 함수 참조 업데이트 ---
  useEffect(() => {
    // 모든 Setter Ref 업데이트
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
    speedBoostInfoSetterRef.current = setSpeedBoostInfo; // << 부스트 setter 추가
  });

  // --- JSX 렌더링 구조 ---
  return (
    <div className="app-container">
      {/* 설정 오버레이 */}
      <div className={`overlay setup-overlay ${showSetup ? "" : "hidden"}`}>
        <h1>Random Racer Draw</h1>
        <div className="input-group">
          {" "}
          <label htmlFor="numPlayersInput">참가자 수 (예: 20):</label>{" "}
          <input
            id="numPlayersInput"
            type="number"
            value={numPlayers}
            onChange={handleNumPlayersChange}
            min="2"
            disabled={isRaceRunning}
          />{" "}
        </div>
        <div className="input-group">
          {" "}
          <label htmlFor="playerNamesInput">
            참가자 이름 입력 (한 줄에 한 명):
          </label>{" "}
          <textarea
            id="playerNamesInput"
            rows="5"
            placeholder="(이름 입력 시 참가자 수 자동 설정 /  미 입력 시 랜덤 생성)"
            value={playerNamesInput}
            onChange={handleNamesChange}
            disabled={isRaceRunning}
          />{" "}
        </div>
        <button
          id="startButton"
          className="action-button"
          onClick={handleSetupAndStart}
          disabled={isRaceRunning}
        >
          {" "}
          {isRaceRunning ? "추첨 진행 중..." : "설정 및 추첨 시작!"}{" "}
        </button>
        <p className="error-message">{validationError}</p>
      </div>
      {/* 결과 오버레이 */}
      <div className={`overlay results-overlay ${showResults ? "" : "hidden"}`}>
        <h2>추첨 결과!</h2>
        <div className="winner-list">
          {" "}
          <p>
            🥇 <span id="winner1">{finalResults.winner1}</span>
          </p>{" "}
          <p>
            🥈 <span id="winner2">{finalResults.winner2}</span>
          </p>{" "}
          <p>
            🥉 <span id="winner3">{finalResults.winner3}</span>
          </p>{" "}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {" "}
          <button
            className="restart-button"
            onClick={() => alert("카카오톡 공유 기능은 구현되지 않았습니다.")}
          >
            카카오톡 공유
          </button>{" "}
          <button
            className="restart-button"
            onClick={() => alert("영상 저장 기능은 구현되지 않았습니다.")}
          >
            영상 저장
          </button>{" "}
        </div>
        <button
          id="restartButton"
          className="restart-button"
          onClick={prepareForNewSetup}
        >
          {" "}
          새 추첨 설정{" "}
        </button>
        <p>
          <small>('새 추첨 설정'을 클릭하여 다시 시작)</small>
        </p>
      </div>
      {/* 실시간 순위 표시 */}
      <div className={`live-ranking ${isRaceRunning ? "visible" : ""}`}>
        <h3>실시간 순위</h3>{" "}
        <p>
          1st: <span id="rank1">{liveRanking.rank1}</span>
        </p>{" "}
        <p>
          2nd: <span id="rank2">{liveRanking.rank2}</span>
        </p>{" "}
        <p>
          3rd: <span id="rank3">{liveRanking.rank3}</span>
        </p>
      </div>
      {/* 시간 멈춤 알림 */}
      <div className={`time-freeze-notice ${isTimeFrozen ? "visible" : ""}`}>
        {" "}
        {freezeInfo.message}{" "}
      </div>
      {/* 밀치기(Knock Back) 알림 */}
      <div
        className={`knock-back-notice ${isKnockBackActive ? "visible" : ""}`}
      >
        {" "}
        {knockBackInfo.message}{" "}
      </div>
      {/* 1등 -> 꼴등 알림 */}
      <div
        className={`first-to-last-notice ${
          isFirstToLastActive ? "visible" : ""
        }`}
      >
        {" "}
        {firstToLastInfo.message}{" "}
      </div>
      {/* 속도 증가 알림 추가 */}
      <div
        className={`speed-boost-notice ${isSpeedBoostActive ? "visible" : ""}`}
      >
        {" "}
        {speedBoostInfo.message}{" "}
      </div>
      {/* Three.js 캔버스 마운트 포인트 */}
      <div ref={mountRef} className="three-mount"></div>
      {/* 툴팁 */}
      <div
        className={`tooltip ${tooltip.visible ? "visible" : ""}`}
        style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
      >
        {" "}
        {tooltip.content}{" "}
      </div>
    </div>
  );
}

export default App;
