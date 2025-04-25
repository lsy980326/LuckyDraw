// src/App.js

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import "./App.css"; // CSS 파일 import

// --- 환경 설정 상수 ---
const NUM_WINNERS = 3; // 최종 결과에 표시할 우승자 수
const RACE_DISTANCE = 150; // 레이서들이 달려야 할 거리
const BASE_SPEED = 0.14; // 기본 속도 배율
const SPEED_VARIATION = 0.1; // 속도 무작위성 요소
const CAMERA_FOLLOW_LERP = 0.03; // 카메라 추적 부드러움 (값이 낮을수록 부드러움)
const TRACK_WIDTH = 40; // 레이싱 영역 너비
// *** 이름표/레이서 크기 및 카메라 조정 ***
const LABEL_Y_OFFSET = 2.5; // 이름표 높이
const LABEL_SCALE = 4.0; // 이름표 크기
const RACER_WIDTH = 0.8; // 레이서(원뿔) 너비
const RACER_HEIGHT = 2.5; // 레이서(원뿔) 높이
const CAMERA_FOV = 80; // 카메라 시야각 (세로 화면에서 더 넓게 보이도록)
const initialCameraPosition = new THREE.Vector3(0, 28, -45); // 카메라 시작 위치 (더 위로, 더 뒤로)
// *** 나머지 상수 ***
const RACER_BOBBING_AMOUNT = 0.15; // 레이서 상하 움직임 정도
const RACER_BOBBING_SPEED_FACTOR = 15; // 레이서 상하 움직임 속도
const RANDOM_SPEED_BURST_CHANCE = 0.015; // 속도 폭발 확률
const RANDOM_SPEED_BURST_FACTOR = 1.8; // 속도 폭발 배율
const RANDOM_SLOWDOWN_CHANCE = 0.01; // 감속 확률
const RANDOM_SLOWDOWN_FACTOR = 0.5; // 감속 배율
// *** 시간 멈춤 이벤트 상수 ***
const TIME_FREEZE_CHANCE = 0.001; // 프레임당 시간 멈춤 발동 확률 (낮을수록 드묾)
const TIME_FREEZE_MIN_DURATION = 2.0; // 최소 멈춤 시간 (초)
const TIME_FREEZE_MAX_DURATION = 5.0; // 최대 멈춤 시간 (초)
// --- 색상 및 이름 상수 ---
const FIRST_PLACE_COLOR = new THREE.Color(0xffd700); // 1등 금색
const SECOND_PLACE_COLOR = new THREE.Color(0xc0c0c0); // 2등 은색
const THIRD_PLACE_COLOR = new THREE.Color(0xcd7f32); // 3등 동색
const DEFAULT_LABEL_COLOR = new THREE.Color(0xffffff); // 기본 흰색
const NAME_PREFIXES = [
  "『해방된』",
  "『흉폭한』",
  "『재빠른』",
  "『부러진』",
  "『절름발이』",
  "『멋진』",
  "『못생긴』",
]; // 랜덤 이름 접두사
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
]; // 랜덤 이름 접미사

// --- React 컴포넌트 정의 ---
function App() {
  // --- 상태 관리 (useState) ---
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
  // *** 시간 멈춤 상태 추가 ***
  const [isTimeFrozen, setIsTimeFrozen] = useState(false);
  const [freezeInfo, setFreezeInfo] = useState({
    freezerName: null,
    duration: 0,
    message: "",
  });

  // --- 참조 관리 (useRef) ---
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
  // *** 시간 멈춤 관련 참조 추가 ***
  const timeFreezerIdRef = useRef(null); // 시간을 멈춘 참가자의 ID
  const freezeStartTimeRef = useRef(null); // 멈춤 시작 시간 (elapsedTime 기준)
  const freezeDurationRef = useRef(0); // 실제 멈춤 지속 시간

  // --- 상태 설정 함수 참조 ---
  const liveRankingSetterRef = useRef(setLiveRanking);
  const finalResultsSetterRef = useRef(setFinalResults);
  const isRaceRunningSetterRef = useRef(setIsRaceRunning);
  const showResultsSetterRef = useRef(setShowResults);
  // *** 시간 멈춤 상태 설정 함수 참조 추가 ***
  const isTimeFrozenSetterRef = useRef(setIsTimeFrozen);
  const freezeInfoSetterRef = useRef(setFreezeInfo);

  // --- 유틸리티 함수 ---

  // 체크무늬 텍스처 생성
  const createCheckerboardTexture = useCallback((widthToCover) => {
    const size = 16;
    const data = new Uint8Array(size * size * 3);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const isWhite = x % 4 < 2 !== y % 4 < 2;
        const color = isWhite ? 255 : 0;
        const stride = (y * size + x) * 3;
        data[stride] = data[stride + 1] = data[stride + 2] = color;
      }
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBFormat);
    texture.needsUpdate = true;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter; // 밉맵 비활성화
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(widthToCover / 4, 1);
    return texture;
  }, []);

  // 이름표 스프라이트 생성
  const createNameLabel = useCallback((text) => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const fontSize = 20;
    context.font = `Bold ${fontSize}px Arial`;
    const textMetrics = context.measureText(text);
    const canvasWidth = textMetrics.width + 14;
    const canvasHeight = fontSize + 6;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    context.font = `Bold ${fontSize}px Arial`; // Reset font after resize
    context.fillStyle = "rgba(0, 0, 0, 0.6)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(255, 255, 255, 0.95)";
    context.fillText(text, canvasWidth / 2, canvasHeight / 2);
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
    return sprite;
  }, []);

  // 레이서 제거 및 리소스 해제
  const clearRacers = useCallback(() => {
    console.log("레이서 정리 시작...");
    if (!sceneRef.current) {
      console.log("씬 참조 없음.");
      return;
    }
    const racersToRemove = [...racersRef.current];
    racersToRemove.forEach((racer) => {
      if (racer.mesh) {
        sceneRef.current.remove(racer.mesh);
        racer.mesh.geometry?.dispose();
        racer.mesh.material?.dispose();
      }
      if (racer.labelSprite) {
        sceneRef.current.remove(racer.labelSprite);
        if (racer.labelSprite.material) {
          racer.labelSprite.material.map?.dispose();
          racer.labelSprite.material.dispose();
        }
      }
    });
    racersRef.current = [];
    liveRankingSetterRef.current({ rank1: "---", rank2: "---", rank3: "---" });
    console.log("레이서 정리 완료.");
  }, []);

  // 레이서 생성
  const createRacers = useCallback(
    (currentNumPlayers, currentPlayerNames) => {
      console.log(`${currentNumPlayers}명의 레이서 생성 중...`);
      if (!sceneRef.current || !cameraRef.current) {
        console.error("레이서 생성 불가: 씬 또는 카메라 참조 없음.");
        return;
      }
      clearRacers();

      const startLineZ = 0;
      const spacing =
        currentNumPlayers > 1 ? TRACK_WIDTH / currentNumPlayers : 0;

      const racerGeometry = new THREE.ConeGeometry(
        RACER_WIDTH,
        RACER_HEIGHT,
        16
      );
      racerGeometry.rotateX(Math.PI / 2); // 콘이 위를 향하도록 회전
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
        const racerMeshYBase = RACER_HEIGHT / 4; // 콘의 밑면이 Y=0에 가깝도록 조정
        racerMesh.position.set(posX, racerMeshYBase, startLineZ);
        racerMesh.castShadow = true;
        const playerName = currentPlayerNames[i];
        racerMesh.userData = { name: playerName }; // 이름 데이터 저장

        const labelSprite = createNameLabel(playerName);
        labelSprite.position.set(
          posX,
          racerMesh.position.y + LABEL_Y_OFFSET,
          startLineZ
        );

        sceneRef.current.add(racerMesh);
        sceneRef.current.add(labelSprite);

        newRacers.push({
          id: i,
          mesh: racerMesh,
          labelSprite: labelSprite,
          name: playerName,
          speed: 0,
          targetZ: startLineZ,
          burstFactor: 1.0,
          bobOffset: Math.random() * Math.PI * 2, // Bobbing 시작 위치 랜덤화
          finishTime: -1, // 도착 시간 (음수면 아직 도착 안 함)
        });
      }
      // 사용한 기본 지오메트리/재질 해제 (옵션)
      // racerGeometry.dispose();
      // baseMaterial.dispose();

      racersRef.current = newRacers;
      console.log("레이서 생성 및 씬 추가 완료.");

      // 카메라 초기 위치/타겟 설정
      cameraRef.current.position.copy(initialCameraPosition);
      cameraRef.current.lookAt(0, 0, 0);
      cameraTargetZRef.current = 0;

      // 실시간 순위 초기화
      liveRankingSetterRef.current({
        rank1: "---",
        rank2: "---",
        rank3: "---",
      });
    },
    [clearRacers, createNameLabel]
  );

  // 랜덤 이름 생성
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
    // 이름 섞기 (Fisher-Yates shuffle)
    for (let i = nameArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nameArray[i], nameArray[j]] = [nameArray[j], nameArray[i]];
    }
    return nameArray.slice(0, count);
  }, []);

  // --- 이벤트 핸들러 ---
  const handleNumPlayersChange = (event) => {
    setNumPlayers(parseInt(event.target.value, 10) || 0);
  };
  const handleNamesChange = (event) => {
    setPlayerNamesInput(event.target.value);
  };
  const handleMouseMove = useCallback((event) => {
    if (!mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    clientMouseRef.current = { x: event.clientX, y: event.clientY }; // 뷰포트 기준 좌표 저장
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }, []);
  const handleSetupAndStart = useCallback(() => {
    if (isRaceRunning || isRaceFinishedRef.current) {
      console.warn("시작 불가: 진행 중이거나 리셋 필요.");
      return;
    }
    setValidationError("");
    const namesFromInput = playerNamesInput
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name.length > 0);
    const numNamesEntered = namesFromInput.length;
    let currentNumPlayers = numPlayers;
    let currentPlayerNames = [];

    if (numNamesEntered > 0) {
      if (numNamesEntered < 2) {
        setValidationError("최소 2명 이상 이름을 입력하세요.");
        return;
      }
      currentNumPlayers = numNamesEntered;
      currentPlayerNames = namesFromInput;
      setNumPlayers(currentNumPlayers); // 입력된 이름 수로 참가자 수 업데이트
      console.log(`${currentNumPlayers}명 이름 사용.`);
    } else {
      if (isNaN(currentNumPlayers) || currentNumPlayers < 2) {
        setValidationError("참가자 수를 2명 이상 입력하세요.");
        return;
      }
      currentPlayerNames = generateRandomNames(currentNumPlayers);
      console.log(`랜덤 이름 ${currentNumPlayers}명 생성.`);
    }

    if (NUM_WINNERS > currentNumPlayers) {
      console.warn(
        `경고: 우승자 표시 수(${NUM_WINNERS})가 참가자 수(${currentNumPlayers})보다 많음.`
      );
    }

    setShowSetup(false);
    setShowResults(false);
    isRaceFinishedRef.current = false;

    // *** 시간 멈춤 상태 초기화 ***
    setIsTimeFrozen(false);
    setFreezeInfo({ freezerName: null, duration: 0, message: "" });
    timeFreezerIdRef.current = null;
    freezeStartTimeRef.current = null;
    freezeDurationRef.current = 0;

    createRacers(currentNumPlayers, currentPlayerNames);
    console.log("isRaceRunning 상태 true로 설정");
    setIsRaceRunning(true); // 애니메이션 루프 시작 트리거
    if (clockRef.current) clockRef.current.start(); // 시간 시작
  }, [
    numPlayers,
    playerNamesInput,
    isRaceRunning,
    createRacers,
    generateRandomNames,
  ]);

  const prepareForNewSetup = useCallback(() => {
    if (isRaceRunning) {
      console.warn("리셋 불가: 레이스 진행 중");
      return;
    }
    console.log("새 추첨 준비 중...");
    setShowResults(false);
    setShowSetup(true);
    clearRacers();
    if (cameraRef.current) {
      cameraRef.current.position.copy(initialCameraPosition);
      cameraRef.current.lookAt(0, 0, 0);
    }
    cameraTargetZRef.current = 0;
    isRaceFinishedRef.current = false;
    setIsRaceRunning(false); // 레이스 상태 false
    setValidationError("");
    setFinalResults({ winner1: "---", winner2: "---", winner3: "---" });

    // *** 시간 멈춤 상태 확실히 리셋 ***
    setIsTimeFrozen(false);
    setFreezeInfo({ freezerName: null, duration: 0, message: "" });
    timeFreezerIdRef.current = null;
    freezeStartTimeRef.current = null;
    freezeDurationRef.current = 0;
  }, [isRaceRunning, clearRacers]);

  // --- 레이스 종료 로직 ---
  const finishRace = useCallback(() => {
    if (isRaceFinishedRef.current) return;
    console.log("추첨 종료!");
    isRaceFinishedRef.current = true;
    if (clockRef.current) clockRef.current.stop(); // 시간 정지

    // *** 레이스 종료 시 시간 멈춤 강제 해제 ***
    isTimeFrozenSetterRef.current(false);
    freezeInfoSetterRef.current({
      freezerName: null,
      duration: 0,
      message: "",
    });
    timeFreezerIdRef.current = null;
    freezeStartTimeRef.current = null;
    freezeDurationRef.current = 0;

    // 애니메이션 프레임 중지 (animate 함수 내에서도 중지되지만 확실히 하기 위해)
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
      console.log("finishRace에 의해 애니메이션 프레임 취소됨.");
    }

    // 최종 순위 계산 (도착 시간 기준)
    const finalRanking = [...racersRef.current]
      .filter((r) => r.finishTime >= 0) // 도착한 레이서만 필터링
      .sort((a, b) => a.finishTime - b.finishTime); // 도착 시간 오름차순 정렬

    console.log(
      "최종 순위:",
      finalRanking.map((r) => `${r.name}: ${r.finishTime.toFixed(2)}s`)
    );

    // 최종 결과 상태 업데이트
    finalResultsSetterRef.current({
      winner1: finalRanking[0]?.name || "---",
      winner2: finalRanking[1]?.name || "---",
      winner3: finalRanking[2]?.name || "---",
    });

    // 모든 이름표 색상을 기본 흰색으로 되돌림
    racersRef.current.forEach((racer) => {
      if (racer.labelSprite.material)
        racer.labelSprite.material.color.set(DEFAULT_LABEL_COLOR);
    });

    showResultsSetterRef.current(true); // 결과 오버레이 표시
    isRaceRunningSetterRef.current(false); // 레이스 진행 상태 false로 설정
  }, []); // 의존성 없음 (내부 ref와 setter ref만 사용)

  // --- 툴팁 업데이트 로직 ---
  const updateTooltip = useCallback(() => {
    if (
      racersRef.current.length === 0 ||
      !cameraRef.current ||
      !mountRef.current
    ) {
      if (tooltip.visible) setTooltip((prev) => ({ ...prev, visible: false }));
      hoveredRacerRef.current = null;
      return;
    }

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const racerMeshes = racersRef.current
      .map((r) => r.mesh)
      .filter((mesh) => !!mesh); // 유효한 메쉬만 필터링

    if (racerMeshes.length === 0) return; // 검사할 메쉬가 없으면 중단

    const intersects = raycasterRef.current.intersectObjects(racerMeshes);

    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object;
      // 호버된 객체가 변경되었거나 툴팁이 안 보일 때 새로 설정
      if (hoveredRacerRef.current !== intersectedObject || !tooltip.visible) {
        hoveredRacerRef.current = intersectedObject;
        const racerData = racersRef.current.find(
          (r) => r.mesh === hoveredRacerRef.current
        );
        setTooltip({
          visible: true,
          content: racerData?.name || "?", // userData에서 이름 가져오기
          x: clientMouseRef.current.x + 15, // client 마우스 좌표 사용
          y: clientMouseRef.current.y + 15,
        });
      } else {
        // 호버된 객체가 같으면 위치만 업데이트
        setTooltip((prev) => ({
          ...prev,
          x: clientMouseRef.current.x + 15,
          y: clientMouseRef.current.y + 15,
        }));
      }
    } else {
      // 아무것도 호버되지 않았을 때
      if (hoveredRacerRef.current) {
        // 이전에 호버된 것이 있었다면 숨김
        setTooltip((prev) => ({ ...prev, visible: false }));
      }
      hoveredRacerRef.current = null; // 호버된 객체 참조 해제
    }
  }, [tooltip.visible]); // tooltip.visible 상태에 의존

  // --- 애니메이션 루프 함수 ---
  const animate = useCallback(() => {
    // 필수 참조 확인 및 종료 조건
    if (
      !rendererRef.current ||
      !sceneRef.current ||
      !cameraRef.current ||
      !clockRef.current ||
      !racersRef.current
    ) {
      console.error("애니메이션 중단: 필수 참조 없음");
      isRaceRunningSetterRef.current(false);
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
      return;
    }
    // 레이스가 이미 끝났으면 애니메이션 중지
    if (isRaceFinishedRef.current) {
      if (animationFrameIdRef.current)
        cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
      return;
    }

    const deltaTime = clockRef.current.getDelta();
    const elapsedTime = clockRef.current.getElapsedTime();
    let leadingZ = 0; // 선두 주자의 Z 위치
    let activeRacersCount = 0; // 아직 경주 중인 레이서 수
    const currentRacers = racersRef.current; // 프레임 내에서 일관된 참조 사용

    // *** 시간 멈춤 이벤트 처리 ***
    const currentIsTimeFrozen = timeFreezerIdRef.current !== null;

    // 1. 시간 멈춤 해제 체크
    if (currentIsTimeFrozen && freezeStartTimeRef.current !== null) {
      if (
        elapsedTime - freezeStartTimeRef.current >=
        freezeDurationRef.current
      ) {
        console.log("시간 멈춤 해제!");
        isTimeFrozenSetterRef.current(false);
        freezeInfoSetterRef.current({
          freezerName: null,
          duration: 0,
          message: "",
        });
        timeFreezerIdRef.current = null;
        freezeStartTimeRef.current = null;
        freezeDurationRef.current = 0;
        // 상태 업데이트는 다음 프레임에 반영되므로, currentIsTimeFrozen 플래그는 직접 바꾸지 않음
      }
    }

    // 2. 시간 멈춤 발동 체크 (멈춰있지 않을 때만)
    if (
      !currentIsTimeFrozen &&
      !isRaceFinishedRef.current &&
      currentRacers.length > 0
    ) {
      // 현재 경주 중인(아직 도착 못한) 레이서 필터링
      const racingRacers = currentRacers.filter(
        (r) => r.mesh.position.z < RACE_DISTANCE
      );
      if (racingRacers.length > 0 && Math.random() < TIME_FREEZE_CHANCE) {
        // 시간 멈춤 발동!
        const randomIndex = Math.floor(Math.random() * racingRacers.length);
        const freezer = racingRacers[randomIndex]; // 경주 중인 레이서 중에서만 선택
        const duration =
          TIME_FREEZE_MIN_DURATION +
          Math.random() * (TIME_FREEZE_MAX_DURATION - TIME_FREEZE_MIN_DURATION);

        console.log(
          `${freezer.name}이(가) ${duration.toFixed(1)}초 동안 시간을 멈춥니다!`
        );

        timeFreezerIdRef.current = freezer.id;
        freezeStartTimeRef.current = elapsedTime;
        freezeDurationRef.current = duration;

        const message = `⏱️ ${freezer.name} 님이 ${duration.toFixed(
          1
        )}초 동안 시간을 멈춥니다!`;
        freezeInfoSetterRef.current({
          freezerName: freezer.name,
          duration: duration,
          message: message,
        });
        isTimeFrozenSetterRef.current(true);
        // 상태 업데이트는 다음 프레임에 반영됨
      }
    }

    // *** 레이서 업데이트 ***
    currentRacers.forEach((racer) => {
      const racerMeshYBase = RACER_HEIGHT / 4;
      const isRacerFinished = racer.mesh.position.z >= RACE_DISTANCE;
      // 현재 프레임 기준으로 시간이 멈췄는지, 그리고 현재 레이서가 멈춤 유발자인지 확인
      const canMove =
        timeFreezerIdRef.current === null ||
        racer.id === timeFreezerIdRef.current;

      if (!isRacerFinished) {
        activeRacersCount++; // 아직 도착 못한 레이서 카운트

        // *** 이동 로직은 canMove 조건 안에서만 실행 ***
        if (canMove) {
          // 속도 계산 (기존 로직과 동일)
          let currentTargetSpeed =
            BASE_SPEED + (Math.random() - 0.5) * SPEED_VARIATION;
          racer.burstFactor = 1.0;
          if (Math.random() < RANDOM_SPEED_BURST_CHANCE) {
            racer.burstFactor = RANDOM_SPEED_BURST_FACTOR;
          } else if (Math.random() < RANDOM_SLOWDOWN_CHANCE) {
            racer.burstFactor = RANDOM_SLOWDOWN_FACTOR;
          }
          racer.speed = Math.max(0.02, currentTargetSpeed) * racer.burstFactor;
          let deltaZ = racer.speed * (60 * deltaTime); // 프레임 속도 보정

          // 위치 업데이트
          racer.mesh.position.z += deltaZ;

          // 도착 처리
          if (racer.mesh.position.z >= RACE_DISTANCE) {
            racer.mesh.position.z = RACE_DISTANCE; // 정확히 결승선에 위치
            if (racer.finishTime < 0) {
              // 아직 도착 시간이 기록되지 않았다면
              racer.finishTime = elapsedTime; // 현재 시간 기록
              console.log(
                `${racer.name} 도착! 시간: ${elapsedTime.toFixed(2)}s`
              );
            }
            // 도착 시 Y 위치 고정 (Bobbing 중지)
            racer.mesh.position.y = racerMeshYBase;
            racer.labelSprite.position.y = racerMeshYBase + LABEL_Y_OFFSET;
            racer.labelSprite.position.z = RACE_DISTANCE;
          } else {
            // Bobbing (움직일 때만)
            const bobY =
              Math.sin(
                elapsedTime *
                  RACER_BOBBING_SPEED_FACTOR *
                  (0.8 + racer.speed * 0.5) +
                  racer.bobOffset
              ) * RACER_BOBBING_AMOUNT;
            racer.mesh.position.y = racerMeshYBase + bobY;
            // 라벨 위치 동기화 (움직일 때만)
            racer.labelSprite.position.z = racer.mesh.position.z;
            racer.labelSprite.position.y =
              racer.mesh.position.y + LABEL_Y_OFFSET;
          }
        } else {
          // 시간이 멈췄고, 현재 레이서가 멈춤 유발자가 아닐 때: 아무것도 안 함 (멈춤)
          // 필요하다면 Bobbing도 멈추도록 Y 위치를 고정할 수 있음:
          // racer.mesh.position.y = racerMeshYBase;
          // racer.labelSprite.position.y = racerMeshYBase + LABEL_Y_OFFSET;
        }
      } else {
        // 이미 도착한 레이서 처리 (위치 고정 등)
        racer.mesh.position.z = RACE_DISTANCE;
        racer.labelSprite.position.z = RACE_DISTANCE;
        racer.mesh.position.y = racerMeshYBase;
        racer.labelSprite.position.y = racerMeshYBase + LABEL_Y_OFFSET;
      }
      // 선두 주자 Z 위치 업데이트는 항상 수행
      leadingZ = Math.max(leadingZ, racer.mesh.position.z);
    });

    // 실시간 순위 및 색상 업데이트
    if (currentRacers.length > 0) {
      // 위치 기준 정렬 (Z값이 클수록 앞, 같으면 도착 시간 빠른 순)
      const sortedRacers = [...currentRacers].sort((a, b) => {
        if (b.mesh.position.z !== a.mesh.position.z)
          return b.mesh.position.z - a.mesh.position.z; // Z 위치 내림차순
        // Z 위치가 같으면 도착 여부 및 시간 비교
        if (a.finishTime < 0 && b.finishTime < 0) return 0; // 둘 다 미도착이면 순서 유지
        if (a.finishTime < 0) return 1; // a만 미도착이면 b가 더 빠름
        if (b.finishTime < 0) return -1; // b만 미도착이면 a가 더 빠름
        return a.finishTime - b.finishTime; // 둘 다 도착했으면 시간 오름차순
      });

      // 실시간 순위 상태 업데이트
      liveRankingSetterRef.current({
        rank1: sortedRacers[0]?.name || "---",
        rank2: sortedRacers[1]?.name || "---",
        rank3: sortedRacers[2]?.name || "---",
      });

      // 이름표 색상 업데이트 (Lerp 사용)
      currentRacers.forEach((racer) => {
        const currentRank = sortedRacers.findIndex((sr) => sr.id === racer.id);
        let targetColor = DEFAULT_LABEL_COLOR;
        if (currentRank === 0) targetColor = FIRST_PLACE_COLOR;
        else if (currentRank === 1) targetColor = SECOND_PLACE_COLOR;
        else if (currentRank === 2) targetColor = THIRD_PLACE_COLOR;

        if (racer.labelSprite.material) {
          racer.labelSprite.material.color.lerp(targetColor, 0.1); // 부드러운 색상 전환
        }
      });
    }

    // 카메라 업데이트 (기존 로직 유지)
    cameraTargetZRef.current = Math.max(0, leadingZ); // 선두 주자 따라가기
    const cameraZOffset =
      initialCameraPosition.z - Math.min(cameraTargetZRef.current * 0.03, 5); // 초기 위치 기반 Z 오프셋 조정
    if (cameraRef.current) {
      // Z 위치 부드럽게 이동
      cameraRef.current.position.z = THREE.MathUtils.lerp(
        cameraRef.current.position.z,
        cameraTargetZRef.current + cameraZOffset,
        CAMERA_FOLLOW_LERP
      );
      // Y 위치 부드럽게 이동 (약간 내려가도록)
      const targetCameraY =
        initialCameraPosition.y - Math.min(cameraTargetZRef.current * 0.02, 4);
      cameraRef.current.position.y = THREE.MathUtils.lerp(
        cameraRef.current.position.y,
        targetCameraY,
        CAMERA_FOLLOW_LERP * 0.8 // Y축은 조금 더 느리게
      );
      // LookAt 타겟 (선두 주자보다 약간 앞, 약간 아래)
      let lookAtTarget = new THREE.Vector3(0, -2, cameraTargetZRef.current + 5);
      // 카메라 약간의 좌우 흔들림 추가
      const wobbleX = Math.sin(elapsedTime * 0.7) * 0.4;
      cameraRef.current.position.x = THREE.MathUtils.lerp(
        cameraRef.current.position.x,
        wobbleX,
        CAMERA_FOLLOW_LERP * 0.3 // X축은 더 느리게
      );
      cameraRef.current.lookAt(lookAtTarget); // 계산된 타겟 바라보기
    }

    // 종료 조건 확인 (activeRacersCount 사용)
    if (
      activeRacersCount === 0 &&
      currentRacers.length > 0 &&
      !isRaceFinishedRef.current
    ) {
      console.log("모든 레이서 도착 감지, 추첨 종료 호출");
      finishRace(); // 모든 레이서가 도착하면 레이스 종료
    }
    // 툴팁 업데이트
    updateTooltip();
    // 렌더링
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
    // 다음 프레임 요청 (레이스가 끝나지 않았다면)
    if (!isRaceFinishedRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(animate);
    } else {
      // 레이스가 끝났다면 애니메이션 프레임 확실히 정리
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    }
  }, [finishRace, updateTooltip]); // 의존성 배열 업데이트

  // --- useEffect: Three.js 초기화 및 정리 ---
  useEffect(() => {
    console.log("초기화 useEffect 실행...");
    if (!mountRef.current) {
      console.log("마운트 참조 준비 안됨.");
      return;
    }
    const currentMount = mountRef.current;
    let rendererInstance; // 클린업에서 사용할 렌더러 인스턴스

    console.log("Three.js 초기화 시작...");
    // 씬 생성
    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0x1a1a2a); // 어두운 배경색
    sceneRef.current.fog = new THREE.Fog(
      0x1a1a2a,
      RACE_DISTANCE * 0.5,
      RACE_DISTANCE * 1.5
    ); // 안개 효과

    const initialWidth = currentMount.clientWidth || window.innerWidth;
    const initialHeight = currentMount.clientHeight || window.innerHeight;
    console.log(`마운트 크기: ${initialWidth}x${initialHeight}`);

    // 카메라 생성
    cameraRef.current = new THREE.PerspectiveCamera(
      CAMERA_FOV, // 넓은 시야각
      initialWidth / initialHeight, // 종횡비
      0.1, // Near Plane
      1000 // Far Plane
    );
    cameraRef.current.position.copy(initialCameraPosition); // 초기 위치 설정
    cameraRef.current.lookAt(0, 0, 0); // 초기 시점 설정
    console.log("카메라 초기화됨:", cameraRef.current.position);

    // 렌더러 생성
    try {
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      rendererInstance = rendererRef.current;
      rendererRef.current.setPixelRatio(window.devicePixelRatio); // 고해상도 지원
      rendererRef.current.shadowMap.enabled = true; // 그림자 활성화
      rendererRef.current.shadowMap.type = THREE.PCFSoftShadowMap; // 부드러운 그림자
      currentMount.appendChild(rendererRef.current.domElement); // DOM에 캔버스 추가
      rendererRef.current.setSize(initialWidth, initialHeight); // 렌더러 크기 설정
      console.log(
        "렌더러 초기화 완료. 크기:",
        rendererRef.current.getSize(new THREE.Vector2())
      );
    } catch (error) {
      console.error("WebGL 렌더러 생성 오류:", error);
      setValidationError(
        "WebGL 초기화 실패. 브라우저 또는 기기를 확인해주세요."
      );
      return; // 렌더러 생성 실패 시 중단
    }

    // 시계 생성
    clockRef.current = new THREE.Clock(false); // 자동 시작 비활성화

    // 조명 설정
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6); // 은은한 전체 조명
    sceneRef.current.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9); // 주 방향성 조명 (태양광 느낌)
    directionalLight.position.set(5, 50, -40); // 빛의 방향 설정 (오른쪽 위 뒤)
    directionalLight.castShadow = true; // 그림자 생성 설정
    // 그림자 품질 설정
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    // 그림자 범위 설정 (트랙 영역을 충분히 포함하도록)
    directionalLight.shadow.camera.left = -TRACK_WIDTH * 1.3;
    directionalLight.shadow.camera.right = TRACK_WIDTH * 1.3;
    directionalLight.shadow.camera.top = 70;
    directionalLight.shadow.camera.bottom = -70;
    sceneRef.current.add(directionalLight);
    // sceneRef.current.add(new THREE.CameraHelper(directionalLight.shadow.camera)); // 그림자 카메라 영역 디버깅용

    const hemiLight = new THREE.HemisphereLight(0x446688, 0x112233, 0.3); // 하늘/땅 색상의 보조 조명
    sceneRef.current.add(hemiLight);
    console.log("조명 추가됨.");

    // 바닥/트랙 설정
    const trackGeometry = new THREE.PlaneGeometry(
      TRACK_WIDTH * 1.8,
      RACE_DISTANCE * 1.6
    ); // 트랙 크기 (넉넉하게)
    const trackMaterial = new THREE.MeshStandardMaterial({
      color: 0x38384d, // 어두운 트랙 색상
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide, // 양면 렌더링 (필요 없을 수 있음)
    });
    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.rotation.x = -Math.PI / 2; // 바닥으로 눕히기
    track.position.y = -0.5; // 레이서 바닥보다 약간 아래에 위치
    track.position.z = RACE_DISTANCE / 2 - 20; // 트랙 중심 위치 조정
    track.receiveShadow = true; // 그림자 받도록 설정
    sceneRef.current.add(track);
    console.log("트랙 추가됨.");

    // 결승선 설정
    const finishLineGeo = new THREE.PlaneGeometry(TRACK_WIDTH + 10, 3); // 결승선 너비/두께
    const finishLineMat = new THREE.MeshBasicMaterial({
      // color: 0xffffff, // 흰색 기본
      map: createCheckerboardTexture(TRACK_WIDTH + 10), // 체크무늬 텍스처 사용
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const finishLine = new THREE.Mesh(finishLineGeo, finishLineMat);
    finishLine.rotation.x = -Math.PI / 2; // 바닥으로 눕히기
    finishLine.position.set(0, -0.45, RACE_DISTANCE); // 트랙보다 약간 위에, 결승선 위치에 배치
    sceneRef.current.add(finishLine);
    console.log("결승선 추가됨.");

    // 이벤트 리스너 설정: 리사이즈, 마우스 이동
    const handleResize = () => {
      if (!rendererInstance || !cameraRef.current || !currentMount) return;
      const width = currentMount.clientWidth;
      const height = currentMount.clientHeight;
      if (width === 0 || height === 0) return; // 크기가 0이면 업데이트 중단

      cameraRef.current.aspect = width / height; // 카메라 종횡비 업데이트
      cameraRef.current.updateProjectionMatrix(); // 카메라 투영 행렬 업데이트
      rendererInstance.setSize(width, height); // 렌더러 크기 업데이트
      // console.log(`리사이징: ${width}x${height}`);
    };
    handleResize(); // 초기 크기 설정
    window.addEventListener("resize", handleResize);
    currentMount.addEventListener("mousemove", handleMouseMove); // 툴팁을 위한 마우스 이동 감지
    console.log("이벤트 리스너 추가됨.");

    // 초기 렌더링 (필수 요소들이 준비되었는지 확인 후)
    try {
      console.log("초기 렌더링 시도...");
      if (rendererInstance && sceneRef.current && cameraRef.current) {
        rendererInstance.render(sceneRef.current, cameraRef.current);
        console.log("초기 렌더링 성공.");
      } else {
        console.warn("초기 렌더링 건너뜀: 참조 준비 안 됨.");
      }
    } catch (error) {
      console.error("초기 렌더링 중 오류:", error);
    }

    // 클린업 함수: 컴포넌트 언마운트 시 실행
    return () => {
      console.log("클린업: useEffect 클린업 실행 중...");
      // 이벤트 리스너 제거
      window.removeEventListener("resize", handleResize);
      if (currentMount) {
        currentMount.removeEventListener("mousemove", handleMouseMove);
        console.log("클린업: mousemove 리스너 제거됨.");
      } else {
        console.log("클린업: 마운트 요소 없어 mousemove 리스너 제거 못 함.");
      }
      // 애니메이션 중지
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
        console.log("클린업: 애니메이션 프레임 취소됨.");
      }
      // 레이서 정리
      clearRacers();

      // Three.js 리소스 해제
      console.log("클린업: 씬 객체 리소스 해제 중...");
      sceneRef.current?.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => {
              material.map?.dispose();
              material.dispose();
            });
          } else {
            object.material.map?.dispose();
            object.material.dispose();
          }
        }
        if (object.texture) object.texture.dispose();
      });
      console.log("클린업: 씬 객체 리소스 해제 완료.");

      // 렌더러 해제
      if (rendererInstance) {
        console.log("클린업: 렌더러 해제 중...");
        rendererInstance.dispose(); // WebGL 컨텍스트 해제
        if (
          rendererInstance.domElement &&
          currentMount?.contains(rendererInstance.domElement)
        ) {
          try {
            currentMount.removeChild(rendererInstance.domElement); // DOM에서 캔버스 제거
            console.log("클린업: 렌더러 DOM 요소 제거됨.");
          } catch (error) {
            console.warn("클린업: 렌더러 DOM 요소 제거 중 오류:", error);
          }
        }
      } else {
        console.log("클린업: 렌더러 인스턴스 없음.");
      }

      // 참조 초기화
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      clockRef.current = null;
      racersRef.current = [];
      console.log("클린업: 참조 초기화 완료. 클린업 끝.");
    };
  }, [
    createCheckerboardTexture,
    handleMouseMove,
    clearRacers,
    createNameLabel,
  ]); // 초기화 의존성 배열

  // --- useEffect: 애니메이션 루프 시작/중지 ---
  useEffect(() => {
    if (isRaceRunning) {
      console.log("isRaceRunning useEffect: 애니메이션 루프 시작...");
      isRaceFinishedRef.current = false; // 레이스 시작 시 종료 플래그 초기화
      if (animationFrameIdRef.current) {
        // 혹시 이전 프레임이 남아있다면 취소
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      // clockRef.current?.start(); // clock 시작은 handleSetupAndStart에서
      animationFrameIdRef.current = requestAnimationFrame(animate); // 애니메이션 시작
    } else {
      // isRaceRunning이 false가 되면 애니메이션 루프 중지
      if (animationFrameIdRef.current) {
        console.log(
          "isRaceRunning useEffect: isRaceRunning false로 변경되어 애니메이션 루프 중지..."
        );
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      // clockRef.current?.stop(); // clock 중지는 finishRace 또는 prepareForNewSetup에서
    }

    // 컴포넌트 언마운트 또는 isRaceRunning 변경 시 애니메이션 프레임 정리
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
        console.log("isRaceRunning useEffect 클린업: 애니메이션 루프 중지됨.");
      }
    };
  }, [isRaceRunning, animate]); // isRaceRunning 상태 또는 animate 함수 참조 변경 시 실행

  // --- useEffect: 상태 설정 함수 참조 업데이트 ---
  useEffect(() => {
    // 콜백 함수 내에서 최신 상태 setter를 사용하기 위해 ref 업데이트
    liveRankingSetterRef.current = setLiveRanking;
    finalResultsSetterRef.current = setFinalResults;
    isRaceRunningSetterRef.current = setIsRaceRunning;
    showResultsSetterRef.current = setShowResults;
    // *** 시간 멈춤 상태 설정 함수 참조 업데이트 ***
    isTimeFrozenSetterRef.current = setIsTimeFrozen;
    freezeInfoSetterRef.current = setFreezeInfo;
  }); // 매 렌더링 시 업데이트하여 항상 최신 setter 참조 유지

  // --- JSX 렌더링 구조 ---
  return (
    <div className="app-container">
      {/* 설정 오버레이 */}
      <div className={`overlay setup-overlay ${showSetup ? "" : "hidden"}`}>
        <h1>Random Racer Draw</h1>
        <div className="input-group">
          <label htmlFor="numPlayersInput">참가자 수 (예: 20):</label>
          <input
            id="numPlayersInput"
            type="number"
            value={numPlayers}
            onChange={handleNumPlayersChange}
            min="2"
            disabled={isRaceRunning} // 레이스 중 비활성화
          />
        </div>
        <div className="input-group">
          <label htmlFor="playerNamesInput">
            참가자 이름 입력 (한 줄에 한 명):
          </label>
          <textarea
            id="playerNamesInput"
            rows="5"
            placeholder="참가자 1
참가자 2
참가자 3
...etc
(이름 입력 시 참가자 수 자동 설정)"
            value={playerNamesInput}
            onChange={handleNamesChange}
            disabled={isRaceRunning} // 레이스 중 비활성화
          />
        </div>
        <button
          id="startButton"
          className="action-button"
          onClick={handleSetupAndStart}
          disabled={isRaceRunning} // 레이스 중 비활성화
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
        <button
          id="restartButton"
          className="restart-button"
          onClick={prepareForNewSetup} // 새 설정 준비 함수 연결
        >
          새 추첨 설정
        </button>
        <p>
          <small>('새 추첨 설정'을 클릭하여 다시 시작)</small>
        </p>
      </div>

      {/* 실시간 순위 표시 */}
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

      {/* *** 시간 멈춤 알림 추가 *** */}
      <div className={`time-freeze-notice ${isTimeFrozen ? "visible" : ""}`}>
        {freezeInfo.message} {/* 멈춤 정보 메시지 표시 */}
      </div>

      {/* Three.js 캔버스 마운트 포인트 */}
      <div ref={mountRef} className="three-mount"></div>

      {/* 툴팁 */}
      <div
        className={`tooltip ${tooltip.visible ? "visible" : ""}`}
        style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }} // 동적으로 위치 설정
      >
        {tooltip.content}
      </div>
    </div>
  );
}

export default App;
