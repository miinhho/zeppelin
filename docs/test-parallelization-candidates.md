<!--
Licensed to the Apache Software Foundation (ASF) under one or more
contributor license agreements.  See the NOTICE file distributed with
this work for additional information regarding copyright ownership.
The ASF licenses this file to You under the Apache License, Version 2.0
(the "License"); you may not use this file except in compliance with
the License.  You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# Test parallelization candidates

이 문서는 테스트를 병렬화하기 전에 테스트 코드에서 확인한 상태 공유,
외부 프로세스, 파일/포트, 전역 상태, sleep/timeout 의존성을 기록한다.
기본 테스트 실행은 아직 변경하지 않으며, 아래의 명시적 opt-in 프로파일로
병렬화 가설만 검증한다.

## 분류 원칙

| 그룹 | 의미 | 다음 조치 |
|---|---|---|
| P0 | 순수하고 독립적인 unit test | 즉시 병렬화 후보 |
| P1 | 독립적이지만 초기화·파일 I/O·검색 인덱스 등으로 느린 test | 격리 확인 후 최우선 병렬화 |
| S | server, interpreter process, port, shared repository, static/global state 등을 공유 | 직렬 유지 |
| T | sleep, polling, timeout, retry로 시간이 늘어나는 test | fake time 또는 event 기반 개선 후보 |

T는 S와 겹칠 수 있다. 예를 들어 `RecoveryTest`는 server와 interpreter
상태를 공유하므로 S이고, 동시에 다수의 sleep/Awaitility를 사용하므로 T다.
이 문서에서는 `S/T`처럼 표시한다.

## 현재 실행 경계

- `core-modules`는 `zeppelin-server`, web, shell, markdown 및 upstream module을
  하나의 `mvn verify` 호출로 실행한다.
- `zeppelin-server` Surefire는 현재 `forkCount=1`, `reuseForks=false`이고,
  테스트 임시 디렉터리를 해당 module의 `target`으로 지정한다.
- interpreter integration도 `forkCount=1`, `reuseForks=false`다.
- 따라서 현재 단일 fork 설정은 테스트 간 공유 상태를 해결하는 것이 아니라,
  한 JVM에서 테스트를 직렬로 실행하고 각 test class 이후 fork를 폐기하는
  방식이다.

## P0 — 즉시 병렬화 후보

아래는 테스트 본문이 값 변환, parser, 결과 모델, collection, utility를
검증하고 외부 server/process/고정 파일을 사용하지 않는 고신뢰 후보들이다.

### `zeppelin-interpreter`

- `InterpreterResultTest`: result type/message/error 모델 검증
- `SingleRowInterpreterResultTest`: 단일 row 결과 변환
- `ByteBufferUtilTest`: byte buffer utility
- `SqlSplitterTest`: SQL 분리
- `IdHashesTest`: ID/hash utility
- `ResourceSetTest`, `ResourceTest`: resource 모델
- `TableDataUtilsTest`, `TableDataProxyTest`, `InterpreterResultTableDataTest`:
  table data 변환
- `InterpreterContextTest`: context 값과 property 검증
- `InterpreterHookRegistryTest`: hook registry 동작

### `zeppelin-server`

- `ParagraphTextParserTest`: paragraph text parsing
- `NoteTest`: note model 동작
- `CredentialInjectorTest`: credential injection
- `NoteAuthTest`: note authorization 계산
- `LdapFilterEncoderTest`, `LdapFilterEncoderFuzzTest`: LDAP filter encoding
- `CredentialsTest`, `EncryptorTest`: credential/encryption utility
- `ExceptionUtilsTest`, `CorsUtilsTest`, `PEMImporterTest`:
  utility/encoding 검증
- `AnyOfRolesUserAuthorizationFilterTest`: authorization filter
- `UpdateInterpreterSettingRequestTest`: request DTO 변환
- `AllowedContentTypeFilterTest`: content-type filter
- `TicketContainerTest`: ticket container

이 그룹에서도 `System.setProperty`, static singleton, 공용 fixture를 사용하는
메서드는 최종 P0 목록에서 제외해야 한다. 특히 test class의 `@BeforeAll`이
전역 설정을 변경하는지 확인한 뒤 병렬 그룹에 넣는다.

### 기타 interpreter module의 순수 후보

- `markdown`: `Markdown4jParserTest`, `FlexmarkParserTest`
- `jdbc`: `SqlCompleterTest`, interpolation/configuration 변환 테스트
- `java`: `JavaInterpreterUtilsTest`, `StaticReplTest` 중 static state를
  변경하지 않는 메서드
- `spark`: `SparkUtilsTest`, display model 테스트 중 SparkContext를 만들지
  않는 메서드

## P1 — 느리지만 독립성 확인 후 병렬화할 후보

이 그룹은 현재 코드상 외부 backend를 직접 띄우지는 않지만, 파일 I/O,
검색 인덱스, Git repository, Helium/npm, classloader 또는 interpreter
설정 초기화가 있어 P0보다 격리 확인이 필요하다.

### Search

- `LuceneSearchTest`
  - `canIndexAndQuery`
  - `canIndexAndQueryByNotebookName`
  - `canIndexAndQueryByParagraphTitle`
  - `indexKeyContract`
  - `canNotSearchBeforeIndexing`
  - `canIndexAndReIndex`
  - `canDeleteNull`
  - `canDeleteFromIndex`
  - `indexParagraphUpdatedOnNoteSave`
  - `indexNoteNameUpdatedOnNoteSave`
  - `keepsReadableResultsThatTheCutWouldHide`
  - `returnsNothingWhenTheCallerMayReadNothing`
- `LuceneSearchTest`의 `drainSearchEvents()`는 event queue가 비워진 뒤에도
  추가로 1초 sleep한다. 따라서 위 테스트들은 P1/T 후보이기도 하다.
- `EmbeddingSearchTest`
  - `canIndexAndQuery`
  - `canIndexAndQueryByNotebookName`
  - `canIndexAndQueryByParagraphTitle`
  - `semanticSearchFindsRelatedConcepts`
  - `indexKeyContract`
  - `canNotSearchBeforeIndexing`
  - `canIndexAndReIndex`
  - `canDeleteNull`
  - `canDeleteFromIndex`
  - `indexParagraphUpdatedOnNoteSave`
  - `newParagraphIsLiveIndexed`
  - `keepsReadableResultsThatTheCutWouldHide`
  - `returnsNothingWhenTheCallerMayReadNothing`
- `EmbeddingSearchTest`의 `newNoteWithParagraph()`와 `drainSearchEvents()`는
  event queue를 확인하면서 500ms sleep한다. 따라서 이 테스트들도 P1/T다.

두 클래스는 `startUp()`에서 검색 인덱스를 만들고 `drainSearchEvents()`에서
비동기 event 처리를 기다린다. 각 클래스의 index directory와 event executor가
분리되는지 확인한 후 class 단위 병렬화를 우선 검토한다.

### Notebook repository / recovery

- `VFSNotebookRepoTest`
  - `testBasics`
  - `testNoteNameWithColon`
  - `testUpdateSettings`
  - `testSkipInvalidFileName`
  - `testSkipInvalidDirectoryName`
  - `testMoveFolderRequiresAbsolutePath`
  - `testRemoveFolderRequiresAbsolutePath`
- `GitNotebookRepoTest`: repository 생성·저장·이동·삭제를 검증하는
  `@Test` 전체
- `NotebookRepoSyncTest`
  - `testRepoCount`
  - `testSyncOnCreate`
  - `testSyncOnDelete`
  - `testSyncUpdateMain`
  - `testSyncOnReloadedList`
  - `testOneWaySyncOnReloadedList`
  - `testCheckpointOneStorage`
  - `testSyncWithAcl`
  - `testRemoveSucceedsWhenSecondaryRepoFails`
  - `testRemoveFailsWhenPrimaryRepoFails`
- `NotebookRepoSyncInitializationTest`: initialization/failure 관련 `@Test` 전체
- `FileSystemRecoveryStorageTest`
  - `testSingleInterpreterProcess`
  - `testMultipleInterpreterProcess`
- `LocalRecoveryStorageTest`
  - `testSingleInterpreterProcess`
  - `testMultipleInterpreterProcess`

P1로 두려면 각 test의 temporary root가 독립적이고, 현재 working directory나
공용 Git repository를 사용하지 않는다는 확인이 필요하다.

### Plugin / Helium / installation

- `PluginManagerTest.testLoadGitNotebookRepo`
- `HeliumBundleFactoryTest`의 install/package 관련 `@Test` 전체
- `HeliumLocalRegistryTest.testGetAllPackage`
- `HeliumOnlineRegistryTest`의 registry 조회 테스트
- `InstallInterpreterTest`의 `testList` 및 setting 조회 테스트

Helium/npm, plugin classloader, interpreter installation은 실행 시간이 길 수
있지만 cache directory와 환경변수를 공유할 가능성이 있어 P0가 아닌 P1로
분류한다.

## S — 직렬 유지

### Server fixture를 공유하는 테스트

다음 클래스는 `MiniZeppelinServer`, REST/WebSocket fixture, interpreter
setting, notebook repository 또는 server singleton을 사용한다.

- `NotebookServerTest`
  - `testUnicastNoteJobInfo_whenJobManagerDisabled`
  - `testBroadcastUpdateNoteJobInfo_whenJobManagerDisabled`
  - `testCollaborativeEditing`
  - `testMakeSureNoAngularObjectBroadcastToWebsocketWhoFireTheEvent`
  - `testAngularObjectSaveToNote`
  - `testLoadAngularObjectFromNote`
  - `testImportNotebook`
  - `testImportJupyterNote`
  - `testCreateNoteWithDefaultInterpreterId`
  - `testRuntimeInfos`
  - `testCloneNoteClonesTheRequestedSourceNote`
  - `testGetParagraphList`
  - `testNoteRevision`
- `ZeppelinRestApiTest`
  - `testNoteCreate*`
  - `testDeleteNote*`
  - `testExportNote`, `testImportNotebook`, `testCloneNote`
  - `testListNotes`, `testNoteJobs`, `testGetNoteJob`
  - `testRunParagraphWithParams`, `testCronDisabledInAnonymousMode`
  - `testInsertParagraph`, `testUpdateParagraph`, `testMoveParagraph`,
    `testDeleteParagraph`, `testTitleSearch`
- `NotebookRestApiTest`
- `InterpreterRestApiTest`
- `SessionRestApiTest`
- `SecurityRestApiTest`
- `NotebookSecurityRestApiTest`
- `ConfigurationsRestApiTest`
- `AuthenticatedCronRestApiTest`
- `MetricEndpointTest`
- `RequestHeaderSizeTest`

REST/WebSocket 테스트는 메서드 단위로 나누기보다 fixture lifecycle 단위로
직렬 유지하는 것이 안전하다. 각 class의 `@BeforeAll`/`@AfterAll`이 server를
시작하고 종료하는 구조이므로, test method만 병렬화해도 같은 server state를
동시에 변경할 수 있다.

### Interpreter process / event / lifecycle

- `RemoteInterpreterServerTest`
  - `testStartStop`
  - `testStartStopWithQueuedEvents`
  - `testInterpreter`
- `RemoteInterpreterEventServerTest`: event ordering 및 timeout 관련 `@Test` 전체
- `RemoteInterpreterTest`: remote process 호출 관련 `@Test` 전체
- `RemoteInterpreterOutputTestStreamTest`: output stream 관련 `@Test` 전체
- `RemoteAngularObjectTest`: `testWatcher` 및 angular event 관련 `@Test` 전체
- `AppendOutputRunnerTest`: append/update ordering 관련 `@Test` 전체
- `InterpreterShellScriptTest`: 실제 process 종료/대기 검증
- `StandardInterpreterLauncherTest`, `SparkInterpreterLauncherTest`:
  launcher/process 환경 검증
- `ManagedInterpreterGroupTest`: interpreter open/close race 검증
- `InterpreterSettingManagerTest`, `InterpreterSettingTest`:
  interpreter setting 및 process lifecycle 검증

### Notebook/scheduler concurrency

- `NotebookTest`
  - `testRunBlankParagraph`
  - `testRunAll`
  - `testAbortAll`
  - `testSchedule`
  - `testScheduleAgainstRunningAndPendingParagraph`
  - `testSchedulePoolUsage`
  - `testScheduleDisabled`
  - `testScheduleDisabledWithName`
  - `testAutoRestartInterpreterAfterSchedule`
  - `testCronWithReleaseResourceClosesOnlySpecificInterpreters`
  - `testCronNoteInTrash`
  - `testResourceRemovealOnParagraphNoteRemove`
  - `testAngularObjectRemovalOnNotebookRemove`
  - `testAngularObjectRemovalOnParagraphRemove`
  - `testAngularObjectRemovalOnInterpreterRestart`
  - `testAbortParagraphStatusOnInterpreterRestart`
  - `testPerSessionInterpreterCloseOnNoteRemoval`
  - `testPerSessionInterpreter`
  - `testPerNoteSessionInterpreter`
- `RemoteSchedulerTest`
  - `test`
  - `testAbortOnPending_noteModeSerial`
  - `testParallelExecution_bothJobsRunConcurrently`
- `NoteManagerMoveResaveRaceTest.testConcurrentMoveNoteResaveRace`
- `NotebookServiceRaceConditionTest.testConcurrentMoveAndSave`
- `ConnectionManagerTest`의 concurrent reader/writer 테스트

이 테스트들은 본래 concurrency를 검증하지만, 그것은 테스트 간 병렬 실행을
허용한다는 의미가 아니다. 각 테스트 내부의 race는 유지하되 test fixture와
notebook repository의 공유를 제거하기 전까지는 S다.

## T — 시간 의존성이 큰 테스트

아래는 S와 중복될 수 있으며, 병렬화보다 먼저 대기 방식을 개선할 후보이다.

### 가장 높은 우선순위

- `IdleInterpreterReclaimerTest`
  - timeout/reclaimer 동작을 확인하는 `@Test` 전체
  - 20초 sleep과 reclaimer polling 사용
- `TimeoutLifecycleManagerTest`
  - `testTimeout_1`
  - `testTimeout_2`
  - 15초 sleep 사용
- `RecoveryTest`
  - `testRecovery`
  - `testRecovery_2`
  - `testRecovery_3`
  - `testRecovery_Running_Paragraph_sh`
  - `testRecovery_Finished_Paragraph_python`
  - 5~15초 sleep 및 Awaitility 사용
- `NotebookTest`의 schedule/cron/interpreter restart 메서드
- `RemoteSchedulerTest`의 tick polling 메서드
- `RemoteAngularObjectTest`의 watcher event 메서드
- `AppendOutputRunnerTest`의 buffer flush/event ordering 메서드
- `AngularObjectTest.testWatcher`

### Integration T

- `ZSessionIntegrationTest`
  - `testZSession_Spark`
  - `testZSession_Spark_Submit`
  - `testZSession_Flink`
  - `testZSession_Flink_Submit`
  - `testZSessionCleanup`
- `SparkIntegrationTest`
  - `testLocalMode`
  - `testYarnClientMode`
  - `testYarnClusterMode`
  - `testSparkSubmit`
  - `testScopedMode`
- `SparkSubmitIntegrationTest`
  - `testLocalMode`
  - `testYarnMode`
  - `testCancelSparkYarnApp`
- `ZeppelinSparkClusterTest`의 paragraph running/finished 및 dynamic form 테스트
- `ZeppelinFlinkClusterTest`
  - `testResumeFromCheckpoint`
  - `testResumeFromInvalidCheckpoint`
- `YarnInterpreterLauncherIntegrationTest`
  - `testLaunchShellInYarn`
  - `testJdbcPython_YarnLauncher`

Integration 테스트의 `Thread.sleep`을 fake time으로 바꾸는 것은 실제 Spark,
Flink, YARN, interpreter process의 readiness를 검증하지 못하게 만들 수 있다.
이 그룹은 먼저 fixed sleep을 process exit, paragraph status, application state,
health/readiness event 같은 의미 있는 조건으로 바꾸는 방향이 안전하다.

## 검토 우선순위

1. P0 목록 중 `System`/static/global 접근이 없는 메서드만 별도 Surefire
   include set으로 만든다.
2. `IdleInterpreterReclaimerTest`, `TimeoutLifecycleManagerTest`,
   `RecoveryTest`는 T 개선 전까지 S로 유지한다.
3. `LuceneSearchTest`, `EmbeddingSearchTest`, repository 테스트는 test별
   temporary directory와 executor 종료를 확인한 뒤 P1 병렬화를 검토한다.
4. REST/WebSocket/interpreter integration은 포트와 interpreter process를
   test별로 할당할 수 있다는 증거가 생기기 전까지 S로 둔다.
5. 각 후보의 실제 소요 시간은 현재 분류와 별도로 Surefire XML의 test case
   duration으로 측정한다. 느리다는 이유만으로 P1 또는 T로 승격하지 않는다.

## 아직 결정하지 않은 항목

- 이 문서는 고신뢰 후보와 위험도가 높은 테스트를 먼저 기록한 1차 검토본이다.
- P0/P1로 보이는 모든 interpreter module 테스트의 method-level static state와
  temporary file 사용은 별도 확인이 필요하다.
- 테스트 method 병렬화와 Maven module/job 병렬화는 별개의 변경이다. 이 문서는
  먼저 test fixture 격리 여부를 판단하기 위한 것이며, CI matrix 변경을
  제안하지 않는다.

## 개별 실행 측정 결과

2026-09-21에 SDKMAN의 `17.0.18-amzn`을 선택하고 각 test class를 별도
Maven 프로세스로 실행했다. 측정 명령은 다음 형태다.

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk use java 17.0.18-amzn
./mvnw -B --no-transfer-progress -pl <module> \
  -Dtest=<TestClass> -DfailIfNoTests=false test
```

`Maven elapsed`는 Maven 프로세스 전체 시간이고, `Surefire test time`은
실제 test class 실행 시간이다. 따라서 개별 파일 실행에서는 compiler,
dependency copy, Surefire fork startup 비용이 반복해서 포함된다.

### P0 측정

| Module | Test class | Result | Tests | Surefire test time | Maven elapsed |
|---|---|---:|---:|---:|---:|
| `zeppelin-interpreter` | `InterpreterResultTest` | PASS | 6 | 0.176s | 7s |
| `zeppelin-interpreter` | `SingleRowInterpreterResultTest` | PASS | 2 | 0.110s | 8s |
| `zeppelin-interpreter` | `ByteBufferUtilTest` | PASS | 1 | 0.040s | 6s |
| `zeppelin-interpreter` | `SqlSplitterTest` | PASS | 9 | 0.051s | 6s |
| `zeppelin-interpreter` | `IdHashesTest` | PASS | 3 | 0.139s | 5s |
| `zeppelin-interpreter` | `ResourceSetTest` | PASS | 2 | 0.231s | 8s |
| `zeppelin-interpreter` | `ResourceTest` | PASS | 7 | 0.178s | 6s |
| `zeppelin-interpreter` | `TableDataUtilsTest` | PASS | 2 | 0.057s | 6s |
| `zeppelin-interpreter` | `TableDataProxyTest` | PASS | 1 | 0.126s | 6s |
| `zeppelin-interpreter` | `InterpreterContextTest` | PASS | 1 | 0.074s | 7s |
| `zeppelin-interpreter` | `InterpreterHookRegistryTest` | PASS | 2 | 0.045s | 6s |

P0는 테스트 본문보다 Maven 실행 overhead가 훨씬 크다. 따라서 이 그룹은
각 파일을 별도 CI step으로 나누기보다, 하나의 Surefire 실행 안에서
`parallel=classes` 또는 test group을 사용하는 편이 유리할 가능성이 높다.

### P1 측정

| Module | Test class | Result | Tests | Surefire test time | Maven elapsed |
|---|---|---:|---:|---:|---:|
| `zeppelin-server` | `LuceneSearchTest` | PASS | 12 | 37.13s | 43.50s |
| `zeppelin-server` | `EmbeddingSearchTest` | UNVERIFIED: all skipped | 12 skipped | 0.005s | 6.58s |
| `zeppelin-server` | `VFSNotebookRepoTest` | PASS | 7 | 0.697s | 8s |
| `zeppelin-server` | `GitNotebookRepoTest` | PASS | 11 | 2.657s | 9s |
| `zeppelin-server` | `NotebookRepoSyncTest` | PASS | 10 | 7.675s | 15s |
| `zeppelin-server` | `NotebookRepoSyncInitializationTest` | PASS | 6 | 0.829s | 8s |
| `zeppelin-server` | `FileSystemRecoveryStorageTest` | PASS | 2 | 17.74s | 25s |
| `zeppelin-server` | `LocalRecoveryStorageTest` | PASS | 2 | 17.28s | 25s |
| `zeppelin-server` | `PluginManagerTest` | PASS | 1 | 0.691s | 10s |

P1 중 우선순위가 높은 것은 `LuceneSearchTest`, 두 recovery storage
테스트, `NotebookRepoSyncTest`다. `EmbeddingSearchTest`는 실행 성공이
아니라 12개 전부 skip이므로 모델/환경 조건을 확인하기 전까지 시간 비교에서
제외한다.

### S/T 측정

| Module | Test class | Result | Tests | Surefire test time | Maven elapsed |
|---|---|---:|---:|---:|---:|
| `zeppelin-server` | `TimeoutLifecycleManagerTest` | PASS | 2 | 51.99s | 60s |
| `zeppelin-server` | `IdleInterpreterReclaimerTest` | PASS | 9 | 87.39s | 94s |
| `zeppelin-server` | `RemoteInterpreterEventServerTest` | FAIL | 5, 1 failure | 1.208s | 7s |
| `zeppelin-server` | `AppendOutputRunnerTest` | PASS | 10 | 1.873s | 9s |
| `zeppelin-server` | `RemoteSchedulerTest` | PASS | 3 | 20.28s | 26s |
| `zeppelin-server` | `NotebookServiceRaceConditionTest` | PASS | 1 | 16.24s | 24s |

### 첫 번째 개선: `IdleInterpreterReclaimerTest`

`IdleInterpreterReclaimer`의 idle 판정은 현재 시각과 interpreter group의
마지막 사용 시각을 비교하는 순수한 정책이다. 기존 테스트는 이 정책을 확인하기
위해 10~20초를 실제로 기다리고, 최대 40초까지 polling했다. production의
스케줄링 동작은 바꾸지 않고, `@VisibleForTesting` overload에 기준 시각을
주입할 수 있게 한 뒤 세 개의 정책 테스트만 미래 시각을 직접 전달하도록
변경했다.

`aRunningParagraphKeepsItsInterpreterAlive`는 실제 interpreter JVM, scheduler,
status polling이 5초 threshold 동안 실행 중인 작업을 보호하는지를 검증하므로
현재 단계에서는 실제 sleep을 유지했다. 따라서 이 변경은 전체 테스트를
가상 시간으로 바꾼 것이 아니라, idle threshold 정책과 실제 runtime 보호 검증을
분리한 것이다.

변경 후 개별 실행 결과:

| JDK | Result | Tests | Surefire test time | Maven elapsed |
|---|---:|---:|---:|---:|
| 11.0.31-amzn | PASS | 9 | 49.03s | 58.88s |
| 17.0.18-amzn | PASS | 9 | 47.75s | 56.37s |

기존 JDK 17 측정값 87.39초 대비 Surefire test time이 약 45% 감소했다.
남은 시간의 대부분은 실제 interpreter process와 20초 running paragraph 검증,
fixture 초기화 및 process cleanup이다. 이 변경으로 병렬 실행을 도입한 것은
아니며, 공유 interpreter/process 상태를 그대로 직렬 검증한다.

### 두 번째 개선: `TimeoutLifecycleManagerTest`

이 테스트는 별도 interpreter JVM 안의 `TimeoutLifecycleManager`가 실제 timeout
스케줄러를 실행하고, 실행 중인 paragraph의 status polling을 통해 process를
살려 두는지를 검증한다. 따라서 scheduler를 fake event로 대체하지 않았다.
대신 process가 아직 시작되지 않은 group을 확인하기 위한 의미 없는 15초 대기를
제거하고, timeout threshold를 10초에서 2초로 낮춘 뒤 실제 scheduler가 판단할
수 있도록 5초의 관찰 시간을 남겼다.

변경 후 개별 실행 결과:

| JDK | Result | Tests | Surefire test time | Maven elapsed |
|---|---:|---:|---:|---:|
| 11.0.31-amzn | PASS | 2 | 18.09s | 27.12s |
| 17.0.18-amzn | PASS | 2 | 17.95s | 36.57s |

기존 JDK 17 측정값 51.99초 대비 Surefire test time이 약 65% 감소했다.
JDK별 Maven elapsed 차이는 interpreter process startup/cleanup과 로컬 실행
환경 영향이 있으므로, 이 비교에서는 Surefire test time을 주 지표로 삼는다.

### 세 번째 개선: 검색 event drain

`LuceneSearchTest`와 유사한 검색 테스트는 event executor의 queue가 비었는지만
확인한 뒤 worker가 현재 event를 마칠 시간을 위해 0.5~1초를 추가로 sleep했다.
`NoteEventAsyncListener`에 pending event 수를 추적하는 bounded condition wait를
추가하고, queue와 현재 실행 중인 event가 모두 끝났을 때 즉시 반환하도록 했다.
검색 결과를 확인하기 전에 event 처리가 완료되어야 한다는 조건은 유지된다.

변경 후 `LuceneSearchTest` 결과:

| JDK | Result | Tests | Surefire test time | Maven elapsed |
|---|---:|---:|---:|---:|
| 11.0.31-amzn | PASS | 12 | 16.48s | 25.08s |
| 17.0.18-amzn | PASS | 12 | 18.60s | 29.75s |

기존 JDK 17 측정값 37.13초 대비 Surefire test time이 약 50% 감소했다.
동일한 event completion API를 `EmbeddingSearchTest`와 `NotebookServiceTest`의
검색 검증에도 적용했다.

### 네 번째 개선: `AppendOutputRunnerTest`

`testClubbedData`는 모든 append 입력을 생산한 뒤 scheduled runner가 처리할
시간을 확보하려고 1초를 sleep했다. 입력 생산 thread가 끝난 뒤 runner를 한 번
동기 drain하도록 바꾸어 남은 queue를 확정적으로 처리하게 했다. batching과
최대 callback 수 검증은 유지된다.

변경 후 결과:

| JDK | Result | Tests | Surefire test time | Maven elapsed |
|---|---:|---:|---:|---:|
| 11.0.31-amzn | PASS | 10 | 1.615s | 13.07s |
| 17.0.18-amzn | PASS | 10 | 1.905s | 13.36s |

이 테스트는 원래도 짧아 전체 시간 개선은 측정 오차 범위지만, 고정 sleep을
제거하고 drain 완료를 명시적으로 만들었다.

### 병렬화 공격 실험: 전 server test class

안전 후보만 병렬화한 결과를 일반화하기 전에, 격리 계약이 실제로 어디서
깨지는지 확인하기 위해 `parallel-aggressive`라는 명시적 진단 프로파일을
추가했다. 이 프로파일은 기본 실행에는 영향을 주지 않고, `zeppelin-server`의
모든 test class를 최대 8개의 fork에서 동시에 실행한다.

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk use java 17.0.18-amzn
./mvnw -B --no-transfer-progress -Pparallel-aggressive \
  -pl zeppelin-server -DfailIfNoTests=false test
```

JDK 17에서 2026-09-21에 실행했으며, 전체 완료 전에 반복되는 격리 실패와
정리 지연을 확인하고 중단했다. 중단 시점까지 57개 test report가 생성되었고,
대표적인 실패는 다음과 같다.

| 관찰된 클래스 | 증상 | 추정되는 공유 의존성 | 분류 |
|---|---|---|---|
| `MetricEndpointTest`, `RequestHeaderSizeTest`, `NotebookServerTest` | `Port is not available` | `MiniZeppelinServer`의 포트/Jetty lifecycle | S |
| `RemoteInterpreterEventServerTest`, `RemoteInterpreterOutputTestStreamTest`, `RemoteAngularObjectTest` | event server 자동 포트 실패 또는 interpreter launch 실패 | `RemoteInterpreterEventServer`, interpreter process port, scheduler | S |
| `FileSystemRecoveryStorageTest`, `LocalRecoveryStorageTest`, `TimeoutLifecycleManagerTest` | interpreter process launch 실패 및 timeout assertion 실패 | 공용 event server/process launch 경로, `local-repo/test` | S/T |
| `RemoteSchedulerTest` | 동시 실행 상태 assertion 실패 | scheduler tick과 remote interpreter 상태 전이 | S/T |
| `InstallInterpreterTest` | 설치 결과 assertion 실패 | `ZEPPELIN_HOME`/설치 디렉터리와 외부 실행 환경 | S 또는 환경 의존 |
| `HeliumBundleFactoryTest` | node/yarn 설치와 package build가 느림 | 외부 registry와 test별 local bundle/cache | P1/T |

이 결과에서 중요한 점은 `NotebookRepoSyncTest`처럼 notebook root를
`createTempDirectory`로 분리한 테스트도 완전히 독립적이지 않다는 것이다.
초기화 과정에서 interpreter setting manager와 event server를 만들기 때문에,
파일 root 격리만으로는 병렬 실행 계약을 만족하지 않는다. 반대로
`LuceneSearchTest`, `VFSNotebookRepoTest`, `GitNotebookRepoTest`,
`NotebookRepoSyncInitializationTest`는 별도 임시 root만 사용하고 event server를
띄우지 않는 범위에서 4개 class, 36개 test가 JDK 11/17 모두 통과했다.

현재 코드에서 병렬화의 실마리가 되는 불필요한 의존성은 다음과 같다.

- `AbstractInterpreterTest` 계열은 test class별 `conf_*`와 `interpreter_*`를
  만들지만, interpreter 실행 명령은 여전히 공용 `local-repo/test`와 기본
  `bin/interpreter.sh`에 의존한다.
- `MiniZeppelinServer` fixture는 class별 설정 이름을 받더라도 server port와
  event server port를 자동 할당하므로, 병렬 fork 수가 늘면 포트 allocator와
  readiness/cleanup이 병목이 된다.
- `InterpreterSettingManager` 생성은 notebook repository 테스트처럼 보이는
  테스트에도 interpreter event server, metrics registry, scheduler를
  간접적으로 끌어들인다.
- `System.setProperty` 기반 테스트(`RecoveryStorage`, `InstallInterpreter`,
  일부 interpreter setting 테스트)는 임시 디렉터리를 만들더라도 JVM 또는
  process-wide 설정을 공유한다.
- `HeliumBundleFactoryTest`는 외부 registry와 node/yarn 설치 비용을 사용하므로
  상태 격리는 가능하지만 T 성격의 실행 비용은 남는다.

따라서 다음 개선 순서는 “실패한 테스트를 무조건 직렬화”가 아니라,
fixture의 의존성 그래프를 줄이는 방향으로 잡는다.

1. `MiniZeppelinServer`와 `RemoteInterpreterEventServer`가 명시적인 port
   allocator를 받도록 하여 server/event/interpreter port를 test scope로
   할당하고, `@AfterAll`에서 실제 종료를 확인한다.
2. `AbstractInterpreterTest`의 `ZEPPELIN_HOME`, interpreter dir, conf dir,
   local repo, recovery dir를 하나의 test-scoped root 아래로 묶고, launcher가
   그 root를 반드시 사용하도록 검증한다.
3. `System.setProperty`를 configuration object 주입으로 치환하거나, 최소한
   property snapshot/restore extension을 두어 test class 간 전역 설정 누수를
   막는다.
4. metrics/scheduler singleton을 reset 가능한 test scope로 만들고, static
   registry 중복 등록을 assertion 실패가 아닌 격리 위반 신호로 추적한다.
5. Helium/npm/yarn 테스트는 test별 `HOME`/cache와 instance-scoped command output을
   사용하게 만든 뒤 병렬화한다.

`parallel-aggressive`는 이 개선의 회귀 탐지용으로 유지하되 CI 기본 profile로
승격하지 않는다. 특히 현재 실행 환경의 네트워크/포트 제한도 일부 오류를
증폭했으므로, 각 수정은 JDK 11과 17에서 단일 실행 PASS를 먼저 확인한 후
aggressive profile에서 재검증해야 한다.

### RemoteScheduler signal 전환 검토 결과

`RemoteSchedulerTest`의 100ms tick polling을 latch signal로 바꾸는 실험을
JDK 17에서 수행했으나 `testParallelExecution_bothJobsRunConcurrently`가
실패했다. scheduler의 submit/실행 전이와 remote interpreter의 병렬 상태가
결합된 영역이므로 해당 변경은 되돌렸다. 이 축은 현재 구현을 유지하고, 별도의
테스트용 scheduler seam을 설계한 뒤 다시 접근해야 한다.

`RemoteInterpreterEventServerTest`의 실패 메서드는
`invokeMethodThrowsRpcExceptionWhenSerializationFails`이며,
`InterpreterRPCException`이 발생할 것으로 기대했지만 예외가 발생하지 않았다.
이는 병렬화로 인한 실패가 아니라 현재 JDK 17 단독 실행에서도 재현된 별도
실패다.

### 다섯 번째 개선: port와 interpreter home 격리

공격 실험에서 드러난 free-port race와 프로젝트 루트 의존성을 실제로
제거했다.

- `MiniZeppelinServer`는 `ServerSocket(0)`으로 포트를 미리 선택하지 않고 Jetty를
  HTTP port `0`으로 시작한다. Jetty가 bind한 실제 port를
  `ZeppelinServer.getServerPort()`로 읽어 fixture configuration에 반영한다.
  따라서 free-port 선택과 실제 bind 사이의 TOCTOU race가 없다.
- `RemoteInterpreterEventServer`도 기본 RPC port range가 `:`이면 port `0`으로
  `TServerSocket`을 직접 bind한다. 명시적인 port 또는 제한된 range를 설정한
  경우에만 기존 지정 port 탐색을 사용한다.
- `AbstractInterpreterTest`는 더 이상 module 상위 디렉터리를
  `ZEPPELIN_HOME`으로 사용하지 않는다. class별 temporary home 아래에
  `conf`, `interpreter`, `notebook`, `local-repo`가 생성된다.
- interpreter launcher에 필요한 `bin`, shaded jar, test classes만 temporary
  home에 연결한다. 프로젝트 전체 `zeppelin-server`를 연결하지 않아 JDK 11에서
  `java.io.tmpdir`가 `target`인 경우에도 filesystem loop가 생기지 않는다.
- fixture의 `shutDown()`은 server start가 실패한 경우에도 null executor 때문에
  2차 예외를 만들지 않도록 idempotent하게 처리한다.

검증 결과:

| 실행 | 결과 |
|---|---:|
| JDK 17, targeted aggressive 8 classes | 32 PASS |
| JDK 11, targeted aggressive 8 classes | 32 PASS |
| JDK 17, `RemoteInterpreterTest` 단독 | 17 PASS |
| JDK 17, server fixture 3 classes | 8 PASS |

targeted aggressive 명령은 다음과 같다.

```bash
./mvnw -Pparallel-aggressive -pl zeppelin-server \
  -Dtest=MetricEndpointTest,RequestHeaderSizeTest,RemoteInterpreterTest,\
RemoteInterpreterOutputTestStreamTest,RemoteAngularObjectTest,\
FileSystemRecoveryStorageTest,LocalRecoveryStorageTest,TimeoutLifecycleManagerTest test
```

이 변경으로 server/interpreter 포트와 파일 root 격리는 개선됐지만,
metrics registry의 다른 meter와 interpreter runtime scheduler lifecycle은
아직 별도의 process-wide 의존성으로 남아 있다. 이들은 다음 단계에서 같은
temporary-root/configuration injection 원칙으로 줄여야 한다.

### 나머지 개선 축의 상태

- `RemoteScheduler`의 tick polling: signal 전환 실험이 병렬 실행 검증을 깨뜨려
  되돌렸다. scheduler와 remote interpreter의 submit/running 전이를 분리할
  테스트 seam 없이는 추가 변경하지 않는다.
- `RecoveryTest`: restart와 interpreter process recovery가 결합되어 있다. 로컬
  실행에서는 `python` executable이 없어 Python interpreter가 시작되지 않았고,
  recovery 시나리오가 장시간 대기하여 변경을 적용하지 않았다. Python runtime이
  준비된 CI 환경에서 readiness/event 조건을 먼저 확인해야 한다.
- REST/WebSocket fixture: `MiniZeppelinServer` startup과 실제 port/process를
  공유한다. 개별 `Thread.sleep`을 기계적으로 줄이면 API readiness 또는 recovery
  검증을 약화시킬 수 있어 이번 단계에서는 변경하지 않았다.

따라서 이번 라운드에서 실제 적용된 개선은 lifecycle timeout 2개, search event
drain 1개, output drain 1개이며, scheduler/recovery/REST 축은 검토 결과를
기록하고 보류했다.

### Same-JVM 병렬 스트레스 실험과 전역 의존성 축소

격리를 무조건 보장한다고 가정하지 않고, 같은 JVM에서 JUnit 5 클래스와 메서드를
동시에 실행하는 `parallel-stress` 프로필을 진단용으로 추가했다. 이 프로필은
fork를 하나만 사용하고 8개의 JUnit worker를 사용하므로, fork 격리로 숨겨지는
다음 의존성이 드러난다.

- `PluginManager`의 plugin classpath 선택을 `System.setProperty("zeppelin.isTest")`
  대신 configuration 생성자 인자로 받도록 변경했다.
- `NotebookRepoSyncTest`와 `NotebookRepoSyncInitializationTest`는 더 이상 전역
  `zeppelin.isTest`를 변경하지 않고, test별 temporary config/home을 사용한다.
- recovery storage 테스트는 전역 system property 대신
  `setUpWithConfiguration`으로 recovery class와 directory를 fixture에 주입한다.
- `RemoteInterpreterTest`의 runner/timeout 설정도 test fixture의 configuration에
  들어가도록 변경했다.
- `InterpreterSettingManager`는 자신이 등록한 total interpreter-group metric을
  `close()`에서 제거한다. 같은 JVM에서 fixture를 반복 생성할 때 Micrometer
  global registry에 남는 metric lifecycle 누수를 줄이기 위한 것이다.
- `parallel-stress`는 `forkCount=1`, `parallel=all`, JUnit fixed parallelism 8로
  실제 worker 간 동시 실행을 강제한다. 기본 CI profile에는 적용하지 않는다.

검증 결과:

| 실행 | 결과 | 의미 |
|---|---:|---|
| JDK 17, `PluginManagerTest` + `NotebookRepoSyncInitializationTest` | 7 PASS, 5.98초 | `ForkJoinPool-1-worker-*` 동시 실행 확인 |
| JDK 17, interpreter/recovery/repo 대상 6 classes | 38 PASS, 25.52초 | temporary home, dynamic port, configuration injection 상태에서 동시 실행 통과 |
| JDK 11, interpreter/recovery/repo 대상 6 classes | 38 PASS, 27.68초 | 동일한 worker 병렬 실행과 격리 계약 통과 |

실험 명령:

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk use java 17.0.18-amzn
./mvnw -Pparallel-stress -pl zeppelin-server \
  -Dtest=RemoteInterpreterTest,FileSystemRecoveryStorageTest,LocalRecoveryStorageTest,\
NotebookRepoSyncTest,NotebookRepoSyncInitializationTest,PluginManagerTest test
```

현재까지 이 대상 집합에서는 테스트 실패가 나오지 않았지만, scheduler thread의
종료 로그와 interpreter process unregister 경고는 여전히 관찰된다. 이는 검증을
통과했다는 뜻이지 lifecycle이 완전히 독립적이라는 뜻은 아니다. 다음 공격 대상은
`Metrics.globalRegistry`의 다른 meter들이다. `SchedulerFactory` 단위 테스트는
singleton 대신 테스트별 executor 이름을 사용하고 `@AfterAll`에서 종료하도록
변경했다. `InterpreterSettingManagerTest`의 include/exclude 재초기화도 전역
system property가 아니라 fixture configuration으로 바꿨다.

Helium은 실제 스트레스에서 두 종류의 문제가 확인됐다. 첫째 Yarn이 사용자
`$HOME/.yarnrc`를 읽어 sandbox에서 실패했으므로, npm/yarn subprocess의 `HOME`을
factory local repo로 고정했다. 둘째 frontend library가 JVM-global logger로
출력을 전달해 서로 다른 factory의 webpack JSON이 섞였다. frontend library를
우회하는 instance-scoped `ProcessBuilder`로 local Node/Yarn을 실행하고 stdout을
각 build 호출에서 직접 받아 parser에 전달하도록 바꿨다. 따라서 global appender와
공용 build lock을 제거할 수 있었다.

추가 검증:

| 실행 | 결과 | 의미 |
|---|---:|---|
| JDK 17, `InterpreterSettingManagerTest` + `InstallInterpreterTest` | 16 PASS | system property 제거 후 통과 |
| JDK 17, `HeliumBundleFactoryTest` same-JVM parallel | 5 PASS, 24.69초 | instance-scoped Yarn stdout, global logger/lock 제거 |
| JDK 17, 전체 server stress 대상 9 classes | 59 PASS, 26.86초 | interpreter/recovery/repo/setting/install/helium 통합 검증 |
| JDK 11, 전체 server stress 대상 9 classes | 59 PASS, 27.97초 | 동일 통합 집합 검증 |

Scheduler 단위 테스트도 JDK 11/17에서 각각 3개 PASS했으며, 각 테스트 클래스가
독립 executor 이름을 사용하고 종료 시 executor를 정리한다.

현재 Helium 영역은 파일/cache와 command output 격리를 달성했으므로 P1/T 후보로
이동했다. 외부 registry와 node/yarn 설치 비용 때문에 빠른 P0는 아니지만, 더 이상
JVM-global logger 때문에 직렬화되지 않는다.

### CI 적용 범위

테스트용 branch의 `.github/workflows/core.yml` `core-modules` job에
`-Pparallel-stress`를 추가했다. 따라서 JDK 11/17 matrix에서
`zeppelin-server` 테스트는 same-JVM 8-way JUnit 병렬 설정으로 실행되고,
interpreter/integration 등 다른 job은 기존 실행 방식을 유지한다. 이 branch에서
실제 CI 전체 결과와 기존 27분 baseline을 비교하기 위한 설정이다.

### JDK 차이

초기에 JDK 21에서 P0를 일부 실행했을 때
`ResourceTest.testInvokeMethod_shouldNotAbleToInvokeMethodWithTypeInference`가
실패했지만, SDKMAN JDK 17에서는 7/7 PASS했다. CI 비교에 JDK 21 결과를
사용하지 않는다. 이후 측정은 CI matrix와 동일한 JDK 11 또는 JDK 17로만
수행해야 한다.
