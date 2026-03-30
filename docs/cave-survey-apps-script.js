/**
 * CAVE Survey v2.1 — Google Apps Script
 *
 * 설치 방법:
 * 1. Google Sheets 새 시트 생성 (이름: "CAVE 설문 데이터")
 * 2. 메뉴 > 확장 프로그램 > Apps Script
 * 3. 이 코드를 Code.gs에 붙여넣기
 * 4. 저장 (Ctrl+S)
 * 5. 배포 > 새 배포 > 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 * 6. 배포 후 나오는 URL을 복사
 * 7. cave-survey-v2-form.html의 GOOGLE_SCRIPT_URL에 붙여넣기
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    // 헤더 자동 생성 (첫 응답 시)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'timestamp',
        'respondent',
        'org',
        'phase',
        'date',
        'q1_AI활용빈도',
        'q2_의사결정분산',
        'q3_자율적실행',
        'q4_위임허들',
        'q5_위임효과',
        'q6_자율성인식',
        'q7_감시인식',
        'q8_정보투명성',
        'q4_reasons',
        'q2_사례',
        'q3_상황',
        'q5_업무',
        'q6_이유',
        'q7_이유',
        'q8_이유'
      ]);

      // 헤더 스타일
      var headerRange = sheet.getRange(1, 1, 1, 20);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f0f0f0');
      sheet.setFrozenRows(1);
    }

    // 데이터 행 추가
    sheet.appendRow([
      new Date().toISOString(),
      data.respondent || '',
      data.org || '',
      data.phase || '',
      data.date || '',
      data.q1 || '',
      data.q2 || '',
      data.q3 || '',
      data.q4 || '',
      data.q5 || '',
      data.q6 || '',
      data.q7 || '',
      data.q8 || '',
      data.q4_reasons || '',
      data['q2_사례'] || '',
      data['q3_상황'] || '',
      data['q5_업무'] || '',
      data['q6_이유'] || '',
      data['q7_이유'] || '',
      data['q8_이유'] || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);

  } finally {
    lock.releaseLock();
  }
}

// GET 요청 테스트용
function doGet(e) {
  return ContentService
    .createTextOutput('CAVE Survey v2.1 endpoint is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}
