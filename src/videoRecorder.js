// // src/videoRecorder.js

// let mediaRecorder = null; // MediaRecorder 인스턴스
// let recordedChunks = []; // 녹화된 비디오 데이터 조각 배열
// let mediaStream = null; // 캔버스에서 가져온 미디어 스트림
// let isRecording = false; // 현재 녹화 중인지 상태 플래그
// let mimeType = ""; // 사용될 MIME 타입 저장

// // 지원되는 MIME 타입 찾기 함수
// const getSupportedMimeType = () => {
//   const types = [
//     "video/webm;codecs=vp9,opus",
//     "video/webm;codecs=vp8,opus",
//     "video/webm;codecs=h264,opus",
//     "video/mp4;codecs=h264,aac", // mp4 지원 시도
//     "video/webm", // 기본 webm
//   ];
//   for (const type of types) {
//     if (MediaRecorder.isTypeSupported(type)) {
//       console.log(`비디오 레코더: 지원되는 MIME 타입 발견: ${type}`);
//       return type;
//     }
//   }
//   console.warn("비디오 레코더: 선호하는 MIME 타입 없음. 기본값 사용.");
//   return types[types.length - 1]; // 마지막 webm 반환
// };

// /**
//  * 캔버스 스트림 녹화를 시작합니다.
//  * @param {HTMLCanvasElement} canvasElement 녹화할 캔버스 요소.
//  * @param {number} frameRate 희망 프레임 레이트 (예: 30).
//  * @returns {boolean} 녹화 시작 성공 여부.
//  */
// export const startRecording = (canvasElement, frameRate = 30) => {
//   console.log("비디오 레코더: startRecording 호출됨.");
//   if (isRecording) {
//     console.warn(
//       "비디오 레코더: 이미 녹화가 진행 중입니다. 이전 녹화를 먼저 중지합니다."
//     );
//     stopRecording().catch((err) =>
//       console.error("비디오 레코더: 이전 녹화 중지 중 오류(무시됨):", err)
//     ); // stopRecording은 Promise 반환하므로 catch 추가
//   }
//   if (!canvasElement || typeof canvasElement.captureStream !== "function") {
//     console.error(
//       "비디오 레코더: 캔버스 요소가 유효하지 않거나 captureStream을 지원하지 않습니다."
//     );
//     return false;
//   }

//   recordedChunks = []; // 이전 데이터 초기화
//   isRecording = false;

//   try {
//     // 캔버스에서 스트림 가져오기
//     mediaStream = canvasElement.captureStream(frameRate);
//     if (!mediaStream || mediaStream.getTracks().length === 0) {
//       console.error("비디오 레코더: 캔버스에서 스트림 캡처 실패.");
//       mediaStream = null;
//       return false;
//     }
//     console.log("비디오 레코더: 캔버스 스트림 캡처 성공.");

//     // 지원되는 MIME 타입 찾기
//     mimeType = getSupportedMimeType();
//     console.log(`비디오 레코더: 사용할 MIME 타입: ${mimeType}`);

//     // MediaRecorder 인스턴스 생성
//     mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
//     console.log("비디오 레코더: MediaRecorder 인스턴스 생성됨.");

//     // 데이터 수집 이벤트 핸들러
//     mediaRecorder.ondataavailable = (event) => {
//       // console.log(`비디오 레코더: ondataavailable 이벤트 발생. 데이터 크기: ${event.data?.size}`); // 너무 자주 로깅될 수 있어 주석 처리
//       if (event.data && event.data.size > 0) {
//         recordedChunks.push(event.data);
//       }
//     };

//     // 녹화 중지 이벤트 핸들러 (Promise 완료 시점과는 별개)
//     mediaRecorder.onstop = () => {
//       // 이 onstop 핸들러는 Promise 버전의 stopRecording 내부 onstop에서 처리하므로 여기선 로깅만 남기거나 비워둠
//       console.log("비디오 레코더: MediaRecorder 네이티브 onstop 이벤트 발생.");
//     };

//     // 오류 이벤트 핸들러 (Promise reject 시점과는 별개)
//     mediaRecorder.onerror = (event) => {
//       // 이 onerror 핸들러는 Promise 버전의 stopRecording 내부 onerror에서 처리하므로 여기선 로깅만 남기거나 비워둠
//       console.error(
//         "비디오 레코더: MediaRecorder 네이티브 onerror 이벤트 발생:",
//         event.error
//       );
//     };

//     // 녹화 시작
//     mediaRecorder.start(100); // 100ms 마다 ondataavailable 발생 시도 (또는 기본값 사용)
//     isRecording = true;
//     console.log("비디오 레코더: MediaRecorder 녹화 시작됨.");
//     return true;
//   } catch (error) {
//     console.error("비디오 레코더: 녹화 시작 중 오류 발생:", error);
//     // 시작 실패 시 자원 정리
//     if (mediaStream) {
//       mediaStream.getTracks().forEach((track) => track.stop());
//       mediaStream = null;
//     }
//     mediaRecorder = null;
//     isRecording = false;
//     recordedChunks = [];
//     return false;
//   }
// };

// /**
//  * 현재 진행 중인 녹화를 중지하고, 완료될 때까지 기다리는 Promise를 반환합니다.
//  * @returns {Promise<void>} 녹화 중지가 완료되면 resolve되는 Promise.
//  */
// export const stopRecording = () => {
//   console.log("비디오 레코더: stopRecording 호출됨 (Promise 버전).");

//   return new Promise((resolve, reject) => {
//     if (!isRecording || !mediaRecorder) {
//       console.log("비디오 레코더: 녹화 중이 아님. 즉시 resolve.");
//       if (mediaStream) {
//         console.log(
//           "비디오 레코더: 남아있는 스트림 정리 (stopRecording Promise)."
//         );
//         mediaStream.getTracks().forEach((track) => track.stop());
//         mediaStream = null;
//       }
//       isRecording = false;
//       resolve();
//       return;
//     }

//     const recorder = mediaRecorder;
//     const stream = mediaStream; // 클로저를 위해 로컬 변수 사용

//     // onstop 이벤트 핸들러: Promise 완료 처리
//     const handleStop = () => {
//       console.log(
//         "비디오 레코더: onstop 이벤트 발생. Promise를 resolve합니다."
//       );
//       if (stream) {
//         console.log("비디오 레코더: onstop에서 스트림 트랙 중지 시도...");
//         stream.getTracks().forEach((track) => track.stop());
//         mediaStream = null; // 전역 참조 해제
//         console.log("비디오 레코더: onstop에서 스트림 트랙 중지 완료.");
//       } else {
//         console.log("비디오 레코더: onstop에서 중지할 스트림 없음.");
//       }
//       isRecording = false; // 상태 업데이트
//       mediaRecorder = null; // 전역 참조 해제
//       // 이벤트 리스너 제거 (메모리 누수 방지)
//       recorder.removeEventListener("stop", handleStop);
//       recorder.removeEventListener("error", handleError);
//       resolve();
//     };

//     // onerror 이벤트 핸들러: Promise 실패 처리
//     const handleError = (event) => {
//       console.error(
//         "비디오 레코더: onerror 이벤트 발생. Promise를 reject합니다:",
//         event.error
//       );
//       if (stream) {
//         console.log("비디오 레코더: onerror에서 스트림 트랙 중지 시도...");
//         stream.getTracks().forEach((track) => track.stop());
//         mediaStream = null;
//       }
//       isRecording = false;
//       mediaRecorder = null;
//       // 이벤트 리스너 제거
//       recorder.removeEventListener("stop", handleStop);
//       recorder.removeEventListener("error", handleError);
//       reject(event.error);
//     };

//     // 이벤트 리스너 등록
//     recorder.addEventListener("stop", handleStop);
//     recorder.addEventListener("error", handleError);

//     // 녹화 중지 명령 실행
//     try {
//       if (recorder.state === "recording") {
//         console.log("비디오 레코더: mediaRecorder.stop() 호출 중...");
//         recorder.stop(); // 이 호출이 비동기적으로 onstop 또는 onerror를 트리거함
//       } else {
//         // 이미 멈춘 상태면 즉시 완료 처리
//         console.log(
//           `비디오 레코더: mediaRecorder 상태가 'recording'이 아님(${recorder.state}). 즉시 resolve.`
//         );
//         if (stream) {
//           stream.getTracks().forEach((track) => track.stop());
//           mediaStream = null;
//         }
//         isRecording = false;
//         mediaRecorder = null;
//         recorder.removeEventListener("stop", handleStop); // 리스너 제거 필수
//         recorder.removeEventListener("error", handleError);
//         resolve();
//       }
//     } catch (error) {
//       console.error(
//         "비디오 레코더: mediaRecorder.stop() 호출 중 즉시 오류 발생:",
//         error
//       );
//       if (stream) {
//         stream.getTracks().forEach((track) => track.stop());
//         mediaStream = null;
//       }
//       isRecording = false;
//       mediaRecorder = null;
//       recorder.removeEventListener("stop", handleStop); // 리스너 제거 필수
//       recorder.removeEventListener("error", handleError);
//       reject(error);
//     }
//     console.log(
//       "비디오 레코더: stopRecording Promise 설정 완료. onstop/onerror 이벤트 대기 중..."
//     );
//   });
// };

// /**
//  * 녹화된 비디오 데이터를 파일로 저장합니다.
//  * @param {string} filename 저장할 파일 이름.
//  */
// export const saveRecording = (filename = "race_recording.webm") => {
//   console.log("비디오 레코더: saveRecording 호출됨. 파일명:", filename);
//   if (recordedChunks.length === 0) {
//     console.warn("비디오 레코더: 저장할 녹화 데이터가 없습니다.");
//     alert("녹화된 영상 데이터가 없습니다.");
//     return;
//   }
//   console.log(`비디오 레코더: ${recordedChunks.length}개의 청크를 저장합니다.`);
//   try {
//     const blob = new Blob(recordedChunks, { type: mimeType });
//     console.log(
//       "비디오 레코더: Blob 생성됨. 크기:",
//       blob.size,
//       "타입:",
//       blob.type
//     );
//     const url = URL.createObjectURL(blob);
//     console.log(
//       "비디오 레코더: Object URL 생성됨:",
//       url.substring(0, 100) + "..."
//     ); // 너무 길어서 일부만 로깅

//     const a = document.createElement("a");
//     document.body.appendChild(a);
//     a.style.display = "none";
//     a.href = url;
//     a.download = filename;
//     console.log("비디오 레코더: 다운로드 링크 클릭 트리거...");
//     a.click();

//     // 정리: URL 해제 및 링크 제거 (revoke는 약간 시간차를 두고 하는 것이 안정적일 수 있음)
//     setTimeout(() => {
//       window.URL.revokeObjectURL(url);
//       console.log("비디오 레코더: Object URL 해제 완료.");
//     }, 100); // 100ms 후 해제
//     document.body.removeChild(a);
//     console.log("비디오 레코더: 임시 링크 제거 완료.");

//     console.log(
//       `비디오 레코더: 녹화 파일 ${filename} 저장 시작됨. 청크 데이터 초기화.`
//     );
//     recordedChunks = []; // 저장 후 청크 데이터 비우기
//   } catch (error) {
//     console.error("비디오 레코더: 녹화 저장 중 오류 발생:", error);
//     alert("영상 저장 중 오류가 발생했습니다.");
//     // 오류 시 청크를 비우지 않아 재시도 가능하게 할 수도 있음 (현재는 비움)
//     recordedChunks = [];
//   }
// };

// /**
//  * 현재 녹화 중인 내용이나 수집된 데이터를 저장하지 않고 폐기합니다.
//  */
// export const discardRecording = () => {
//   if (isRecording) {
//     console.log("비디오 레코더: 활성 녹화 폐기 중...");
//     // stopRecording Promise를 기다리지 않고 호출만 하여 중지 시도
//     stopRecording().catch((err) =>
//       console.warn("비디오 레코더: discard 중 stop 에러(무시됨):", err)
//     );
//   }
//   if (recordedChunks.length > 0) {
//     console.log("비디오 레코더: 이전에 녹화된 청크 데이터 폐기.");
//     recordedChunks = [];
//   }
//   // 상태 플래그 확실히 리셋
//   isRecording = false;
//   mediaRecorder = null;
//   mediaStream = null;
// };

// /**
//  * 저장할 녹화 데이터가 있는지 확인합니다.
//  * @returns {boolean} 녹화된 청크가 있으면 true, 없으면 false.
//  */
// export const hasRecordedData = () => {
//   return recordedChunks.length > 0;
// };

// /**
//  * 현재 녹화가 활성 상태인지 확인합니다.
//  * @returns {boolean} 녹화 중이면 true, 아니면 false.
//  */
// export const getIsRecording = () => {
//   return isRecording;
// };
// src/videoRecorder.js

let mediaRecorder = null;
let recordedChunks = [];
let mediaStream = null; // 이제 화면 공유 스트림이 될 수 있음
let isRecording = false;
let mimeType = "";

// 지원되는 MIME 타입 찾기 (MP4 우선)
const getSupportedMimeType = () => {
  const types = [
    "video/mp4;codecs=h264,aac",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      console.log(`비디오 레코더: 지원 MIME 타입: ${type}`);
      return type;
    }
  }
  console.warn("비디오 레코더: MP4/선호 WebM 코덱 없음. 기본 WebM 사용.");
  return "video/webm";
};

/**
 * 화면 공유 API(getDisplayMedia)를 사용하여 화면 녹화를 시작합니다.
 * 사용자에게 공유할 화면(탭, 창, 전체 화면) 선택 및 권한 요청을 합니다.
 * @param {number} frameRate 희망 프레임 레이트. (getDisplayMedia에서는 정확히 보장되지 않을 수 있음)
 * @returns {Promise<boolean>} 녹화 시작 성공 시 true, 실패 또는 사용자 거부 시 false Promise 반환.
 */
export const startRecording = async (frameRate = 30) => {
  // <<< async 추가, canvasElement 인수 제거됨
  console.log("비디오 레코더: startRecording (getDisplayMedia 버전) 호출됨.");
  if (isRecording) {
    console.warn("비디오 레코더: 이미 녹화 중. 이전 녹화 중지.");
    await stopRecording().catch((err) =>
      console.error("비디오 레코더: 이전 녹화 중지 오류(무시):", err)
    );
  } // 이전 녹화 완료 대기

  recordedChunks = [];
  isRecording = false;
  mimeType = ""; // 상태 초기화

  // --- getDisplayMedia 호출 ---
  try {
    console.log("비디오 레코더: getDisplayMedia 요청 중... 사용자 승인 대기.");
    // 오디오는 제외하고 비디오만 요청
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: frameRate, // 희망 프레임레이트 설정
      },
      audio: false, // 오디오는 녹음 안 함
    });
    mediaStream = displayStream; // 확보한 스트림 저장
    console.log("비디오 레코더: getDisplayMedia 스트림 확보 성공.");

    // 사용자가 공유 중지 버튼을 눌렀을 때 처리 (선택 사항)
    displayStream.getVideoTracks()[0].onended = () => {
      console.log("비디오 레코더: 사용자가 화면 공유를 중지했습니다.");
      // 앱 상태에 따라 stopRecording()을 호출하거나 다른 처리 수행
      if (isRecording) {
        stopRecording().catch((err) =>
          console.error("비디오 레코더: 공유 중지 시 stopRecording 오류:", err)
        );
      }
    };
  } catch (error) {
    if (error.name === "NotAllowedError" || error.name === "AbortError") {
      console.warn(
        "비디오 레코더: 사용자가 화면 공유 권한을 거부했거나 선택을 취소했습니다."
      );
      alert(
        "화면 녹화를 시작하려면 권한을 허용하고 공유할 화면(탭 권장)을 선택해야 합니다."
      );
    } else {
      console.error("비디오 레코더: getDisplayMedia 오류 발생:", error);
      alert(`화면 공유 시작 중 오류 발생: ${error.message}`);
    }
    mediaStream = null;
    return false; // 실패 시 false 반환
  }

  // --- MediaRecorder 설정 및 시작 ---
  try {
    mimeType = getSupportedMimeType();
    console.log(`비디오 레코더: 사용할 MIME 타입: ${mimeType}`);
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
    console.log("비디오 레코더: MediaRecorder 인스턴스 생성됨.");

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    // onstop, onerror는 stopRecording Promise 내부에서 주로 처리됨

    mediaRecorder.start(100); // 데이터 수집 간격
    isRecording = true;
    console.log("비디오 레코더: 화면 녹화 시작됨.");
    return true; // 성공 시 true 반환
  } catch (error) {
    console.error(
      "비디오 레코더: MediaRecorder 생성 또는 시작 중 오류:",
      error
    );
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    } // 스트림 정리
    mediaRecorder = null;
    isRecording = false;
    recordedChunks = [];
    return false; // 실패 시 false 반환
  }
};

/**
 * 현재 진행 중인 녹화를 중지하고, 완료될 때까지 기다리는 Promise를 반환합니다.
 * 화면 공유 스트림 트랙도 중지합니다.
 * @returns {Promise<void>} 녹화 중지가 완료되면 resolve되는 Promise.
 */
export const stopRecording = () => {
  // 이전 Promise 버전과 동일, 스트림 처리 확인
  console.log("비디오 레코더: stopRecording 호출됨 (Promise 버전).");
  return new Promise((resolve, reject) => {
    // 녹화 중 아니면 즉시 완료
    if (!isRecording || !mediaRecorder) {
      console.log("비디오 레코더: 녹화 중 아님. 즉시 resolve.");
      // 남은 스트림 정리 시도 (getDisplayMedia 스트림)
      if (mediaStream) {
        console.log("비디오 레코더: 남은 getDisplayMedia 스트림 정리.");
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      isRecording = false;
      resolve();
      return;
    }

    const recorder = mediaRecorder;
    const stream = mediaStream;
    let stopHandler, errorHandler;
    stopHandler = () => {
      console.log("비디오 레코더: onstop -> Promise resolve.");
      if (stream) {
        console.log("비디오 레코더: onstop에서 스트림 정리.");
        stream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      } else {
        console.log("비디오 레코더: onstop에서 정리할 스트림 없음.");
      }
      isRecording = false;
      mediaRecorder = null;
      recorder.removeEventListener("stop", stopHandler);
      recorder.removeEventListener("error", errorHandler);
      resolve();
    };
    errorHandler = (event) => {
      console.error("비디오 레코더: onerror -> Promise reject:", event.error);
      if (stream) {
        console.log("비디오 레코더: onerror에서 스트림 정리.");
        stream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      isRecording = false;
      mediaRecorder = null;
      recorder.removeEventListener("stop", stopHandler);
      recorder.removeEventListener("error", errorHandler);
      reject(event.error);
    };
    recorder.addEventListener("stop", stopHandler);
    recorder.addEventListener("error", errorHandler);

    try {
      if (recorder.state === "recording") {
        console.log("비디오 레코더: mediaRecorder.stop() 호출 중...");
        recorder.stop();
      } else {
        console.log(
          `비디오 레코더: 상태 'recording' 아님(${recorder.state}). 즉시 resolve.`
        );
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          mediaStream = null;
        }
        isRecording = false;
        mediaRecorder = null;
        recorder.removeEventListener("stop", stopHandler);
        recorder.removeEventListener("error", errorHandler);
        resolve();
      }
    } catch (error) {
      console.error("비디오 레코더: stop() 호출 중 즉시 오류:", error);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }
      isRecording = false;
      mediaRecorder = null;
      recorder.removeEventListener("stop", stopHandler);
      recorder.removeEventListener("error", errorHandler);
      reject(error);
    }
    console.log(
      "비디오 레코더: stopRecording Promise 설정 완료. 이벤트 대기 중..."
    );
  });
};

/** 파일 저장 (동적 확장자) */
export const saveRecording = (baseFilename = "race_recording") => {
  console.log(
    "비디오 레코더: saveRecording 호출됨. 기본 파일명:",
    baseFilename
  );
  if (recordedChunks.length === 0) {
    console.warn("비디오 레코더: 저장할 데이터 없음.");
    alert("녹화된 영상 데이터가 없습니다.");
    return;
  }
  console.log(`비디오 레코더: ${recordedChunks.length}개 청크 저장 시도.`);
  let extension = ".webm";
  if (mimeType && mimeType.startsWith("video/mp4")) {
    extension = ".mp4";
  }
  const finalFilename = `${baseFilename}${extension}`;
  console.log(`비디오 레코더: 최종 파일명: ${finalFilename}`);
  try {
    const blob = new Blob(recordedChunks, { type: mimeType });
    console.log(
      "비디오 레코더: Blob 생성됨. 크기:",
      blob.size,
      "타입:",
      blob.type
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    a.href = url;
    a.download = finalFilename;
    console.log("비디오 레코더: 다운로드 링크 클릭 트리거...");
    a.click();
    setTimeout(() => {
      window.URL.revokeObjectURL(url);
      console.log("비디오 레코더: Object URL 해제 완료.");
    }, 100);
    document.body.removeChild(a);
    console.log("비디오 레코더: 임시 링크 제거 완료.");
    console.log(`비디오 레코더: ${finalFilename} 저장 시작됨. 청크 초기화.`);
    recordedChunks = [];
  } catch (error) {
    console.error("비디오 레코더: 녹화 저장 중 오류:", error);
    alert("영상 저장 중 오류가 발생했습니다.");
    recordedChunks = [];
  }
};

/** 녹화 폐기 */
export const discardRecording = () => {
  if (isRecording) {
    console.log("비디오 레코더: 활성 녹화 폐기 중...");
    stopRecording().catch((err) =>
      console.warn("비디오 레코더: discard 중 stop 에러(무시됨):", err)
    );
  }
  if (recordedChunks.length > 0) {
    console.log("비디오 레코더: 이전에 녹화된 청크 데이터 폐기.");
    recordedChunks = [];
  }
  isRecording = false;
  mediaRecorder = null;
  mediaStream = null;
};

/** 데이터 유무 확인 */
export const hasRecordedData = () => {
  return recordedChunks.length > 0;
};
/** 녹화 상태 확인 */
export const getIsRecording = () => {
  return isRecording;
};
