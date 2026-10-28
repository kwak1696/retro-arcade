# Retro Arcade 구현 스펙 및 방법론

작성일: 2026-10-29 (Asia/Seoul). 대상 저장소: `nom-web-native`.

## 목표와 현재 제공 범위

정적 웹 페이지 하나에서 휴대폰 게임 6개를 선택해 실행한다.
빌드 시 원본 코드를 JavaScript로 변환하며, 웹 페이지에는 JVM·ARM 명령 디코더·
명령 인터프리터 fallback·Wasm 실행기를 넣지 않는다.

| 선택 값 | 게임 | 원본 형식 | 화면 | 상태 |
|---|---|---|---|---|
| nom | 놈 1 | 해외 Java/J2ME | 176×208 | 실행 가능 |
| nom2 | 놈투 Free Runner | 해외 Java/J2ME | 320×240 | 실행 가능 |
| nom3 | 놈 3 | 국내 LGT WIPI Java AOT / ARM ELF | 240×320 | 사운드 미지원 베타 |
| mini1 | 미니게임천국 1 | 국내 KTF WIPI Clet / ARM·Thumb | 176×220 | 사운드 미지원 베타 |
| mini2 | 미니게임천국 2 | 국내 KTF WIPI Clet / ARM·Thumb | 176×220 | 사운드 미지원 베타 |
| mini3 | 미니게임천국 3 | 국내 KTF WIPI Clet / ARM·Thumb | 240×320 | 사운드 미지원 베타 |

후반 스테이지, 모든 미니게임, 상점·통신 경로를 완전히 검증한 상태는 아니다.
서비스가 종료된 통신사 네트워크·과금·단말 관리 기능은 제공하지 않는다.

## 화면 및 입력

- 게임 선택은 `?game=<선택 값>`으로 문서 전체를 이동한다. 다른 게임의 상태·스레드가 섞이지 않는다.
- CHOOSE YOUR GAME 이전의 헤더·소개, 하단 소개·푸터는 제거했다.
- 게임 화면 클릭/터치와 Space/Enter로 확인·액션을 전달한다. 방향키와 화면 버튼도 지원한다.
- Pointer capture, pointerup/cancel/lostcapture 및 blur 해제로 입력 고착을 줄인다.
- 전체화면은 원래 비율을 유지하며 가능한 최대 크기로 표시한다. 기기 테두리와 캡션은 숨긴다.
- 방향키(각 52px)와 OK(64px)는 측정한 레터박스 안에만 배치한다.
  16px 간격을 확보할 수 없으면 두 묶음을 숨긴다. 게임 화면을 줄이거나 가리지 않는다.
- 회전 시 게임 화면만 회전한다. 컨트롤은 화면 좌표계에 남고 ResizeObserver로 여백을 재측정한다.

## Java/J2ME 빌드 경로

`PatchJar.java`가 난독화 필드의 충돌을 정리하고 리소스 및 시스템 속성 호출을 브라우저
브리지로 연결한다. Java ME 호환 API를 Java로 구현한 후 TeaVM 0.12.3으로 AOT 컴파일한다.
NOM과 NOM2는 각각 Boot / Boot2 진입점을 쓴다. Canvas, 이미지 변환, RMS 저장 및 오디오
브리지는 `src/main/java/`와 `dist/host.js`에 있다.

## WIPI 리버스 및 정적 변환

1. 사용자 ZIP에서 실행 JAR와 게임 리소스만 분리했다. ZIP의 개인 단말 메타데이터는 배포하지 않는다.
2. KTF `client.bin<숫자>`의 숫자를 BSS 크기로 해석하고, 제한된 연구용 Unicorn 메모리에서
   자체 재배치를 실행해 WIPI_exe / ExeInterface 구조를 검증했다.
3. LGT `binary.mod` ELF의 `.text`, `.data`, `.bss`와 Java AOT 클래스·메서드 정보를 추적했다.
4. 시작·그리기·입력 함수와 WIPI 인터페이스 호출을 원본 실행에서 관측했다.
5. Thumb-1 및 ARM 정수·메모리·분기 명령을 빌드 시 정적으로 해석하고 JavaScript 기본 블록으로 내보냈다.
   지원하지 않는 변환 명령은 오류를 내며, 런타임 인터프리터로 우회하지 않는다.
6. LGT import trampoline은 원본 레코드의 table/index를 빌드 시 연결한다.
7. 원본 데이터·재배치 결과·리소스와 생성된 JavaScript를 gzip 자산으로 패키징한다.
8. 브라우저는 선택한 게임의 자산만 내려받아 DecompressionStream으로 풀고 JavaScript 모듈로 실행한다.

원본 Java 소스를 복원한 것은 아니다. 생성 코드에는 정수 레지스터·메모리 의미가 보존되며,
JavaScript 기본 블록과 WIPI 호환 서비스가 실행을 담당한다. Unicorn·Capstone·pyelftools는
연구/빌드 의존성이며 웹 배포물에는 포함하지 않는다.

## WIPI 런타임

- KTF: 간접 메모리, JAR 리소스, RGB565 버퍼, BMP, 그리기·복사, 타이머, 입력, 메모리 파일을 제공한다.
- LGT: 클래스 및 고정 vtable 연결, 상속·배열·문자열·스트림, 예외 unwind, 협력적 스레드,
  PNG 디코딩, RasterGraphics와 파일 API를 제공한다.
- NOM3의 PNG는 fflate 0.8.2로 zlib를 풀고 필터/팔레트/투명도를 처리한다.
- Java AOT 스레드·paint·키 입력은 서로 다른 스택 영역을 사용한다. 중단한 스레드는 레지스터,
  플래그, 재개 위치와 예외 컨텍스트를 유지한다.
- KTF 누름/뗌은 이벤트 2/3, LGT keyNotify는 1/2를 사용한다.
- 저장은 localStorage에 게임별 이름 공간으로 분리한다. 사이트 데이터 삭제 시 저장도 사라진다.
- WIPI 사운드/진동은 현재 무음 처리한다. UI에 베타 및 사운드 미지원을 표시한다.
- 제한된 데이터 힙: KTF 8MiB / NOM3 32MiB. 원본 가비지 컬렉터의 완전한 구현은 아니다.

## 주요 파일

| 파일 | 역할 |
|---|---|
| dist/index.html, app.js, style.css | 선택·플레이어·입력·전체화면 UI |
| src/wipi-runtime.mjs | 생성 코드가 사용하는 정수/메모리 및 KTF 호환 서비스 |
| src/wipi-lgt-runtime.mjs | LGT Java AOT 클래스·예외·스레드·그리기 연결 |
| src/wipi-player.mjs | gzip 로딩·게임 시작·브라우저 프레임/입력 연결 |
| src/wipi-png.mjs, wipi-raster.mjs | PNG 및 픽셀 그래픽 |
| tools/wipi_aot.py, wipi_lgt_aot.py | 네 WIPI 게임의 JavaScript 생성과 패키징 |
| tools/wipi_probe.py, wipi_trace.py | 제한된 원본 실행 관측 및 ABI 검증 |
| tools/wipi_metadata.py, wipi_resources.py | 메타데이터·리소스 구조 조사 |
| tools/test_wipi_* | ABI 경계 및 생성 코드 실행 시나리오 |
| WIPI-REVERSE.md | 초기 리버스부터 후속 변환까지의 단계별 기록 |
| README-PORTING.md | 재현 가능한 빌드 및 실행 절차 |

## 검증 근거

- ABI 경계 테스트 5개: 간접 리소스 복사, 파일 재열기·EOF, 타이머 중복·취소,
  미구현 호출 중단, WDI 잘림, 겹치는 화면 복사.
- 미니게임천국 세 작품의 시작·paint·타이머·OK 입력 실행 시나리오 통과.
- 연구용 ARM 실행 결과와 JavaScript 결과의 boot/menu 8개 장면이 픽셀 단위로 일치했다.
- 놈 3 JavaScript 960프레임 시나리오에서 타이틀·메뉴·도움말·스퀘어·스토리와 첫 플레이 화면을 확인했다.
  `/nom`과 `/nom_sub` 저장 파일은 각각 290바이트를 기록했다.
- Chrome 로컬 페이지에서 실제 모듈 다운로드·시작·그리기를 확인했다.
- 전체화면 버튼 배치는 두 화면 비율, 회전, 화면 크기 28개 조합에서 여백 안 배치를 검사했다.

분석 바이너리·프레임·실험 덤프는 Git에서 제외된 `analysis/`에 둔다.
배포는 dist의 정적 자산을 GitHub Pages 저장소 루트에 반영한다.
소스 보관 ZIP에는 빌드/호환 소스와 문서를 넣고 게임 JAR 및 개인 단말 메타데이터는 넣지 않는다.

## 라이선스와 후속 개선

WIE/wipi-types의 ABI 레이아웃·고정 슬롯 정보를 참고했고 MIT 고지를 포함한다.
fflate의 MIT 고지도 함께 제공한다. 원작 게임·리소스 권리는 GAMEVIL/Com2uS에 있다.

후속 작업은 사운드, 전체 게임/후반 스테이지 회귀 검사, 메모리 수명 관리 고도화,
실제 모바일 기기 입력·회전 검증이다. 현재 구현이 이 항목을 모두 완료했다고 주장하지 않는다.
