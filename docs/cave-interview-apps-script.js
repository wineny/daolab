/**
 * CAVE 중간점검 서면 인터뷰 — Google Apps Script
 *
 * 설치 방법:
 * 1. Google Sheets 새 시트 생성 (이름: "CAVE 중간점검 인터뷰")
 * 2. 메뉴 > 확장 프로그램 > Apps Script
 * 3. 이 코드를 Code.gs에 붙여넣기
 * 4. 저장 (Ctrl+S)
 * 5. 배포 > 새 배포 > 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 액세스 권한: 모든 사용자
 * 6. 배포 후 나오는 URL을 복사
 * 7. cave-interview-form.html의 GOOGLE_SCRIPT_URL에 붙여넣기
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    // form submit 방식: e.parameter.data에 JSON 문자열이 들어옴
    // fetch 방식 fallback: e.postData.contents에 JSON이 들어옴
    var raw = e.parameter && e.parameter.data ? e.parameter.data : e.postData.contents;
    var data = JSON.parse(raw);

    // 헤더 자동 생성 (첫 응답 시)
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        'timestamp',
        'name',
        'q1a_pattern',
        'q1b_route',
        'q2_decision',
        'q2_execution',
        'q2_transparency',
        'q2_perception',
        'q3_ai_ops',
        'q4_autonomy_moment',
        'q5a_conditions',
        'q5a_other',
        'q5b_blocker',
        'q5b_helper',
        'q6_personal',
        'q7_comment'
      ]);

      // 헤더 스타일
      var headerRange = sheet.getRange(1, 1, 1, 16);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f0f0f0');
      sheet.setFrozenRows(1);
    }

    // 데이터 행 추가
    sheet.appendRow([
      new Date().toISOString(),
      data.name || '',
      data.q1a || '',
      data.q1b || '',
      data.q2_decision || '',
      data.q2_execution || '',
      data.q2_transparency || '',
      data.q2_perception || '',
      data.q3 || '',
      data.q4 || '',
      data.q5a || '',
      data.q5a_other || '',
      data.q5b_block || '',
      data.q5b_help || '',
      data.q6 || '',
      data.q7 || ''
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
    .createTextOutput('CAVE Interview endpoint is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}
