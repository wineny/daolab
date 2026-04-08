/**
 * 봇 응답 품질 분석 스크립트
 *
 * 분석 영역:
 * 1. 에러 탐지 — 기술에러(timeout/rate limit/모델실패/과부하/빈응답)
 * 2. 행동 대리지표 — 재요청률, 스레드이탈률, 이모지감성, 후속반응 분류
 * 3. 봇별 품질 점수표 (Behavioral Quality Index)
 * 4. 분류 검증용 200건 표본 추출
 *
 * 방법론 근거:
 * - 에러 분류: Higashinaka et al. (2021) 대화 시스템 에러 분류체계 적용
 * - 행동 대리지표: Jiang et al. (2015) 행동 기반 만족도 추정
 * - 품질 프레임: PARADISE (Walker et al., 1997) 적용
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';

const DATA_DIR = './data/slack-messages';
const OUT_DIR = './data/analysis';

// === Bot & User ID Maps (from deep-analysis.mjs) ===
const BOT_IDS = {
  'U0AFCJ0EB97': { name: '클로찌', owner: '윤누리' },
  'U0AAZEBEEKE': { name: '뽀야', owner: '송다혜(닿)' },
  'U0AGV1N6YDP': { name: '뽀짝이', owner: '송다혜(닿)' },
  'U0AP03YMX18': { name: '뽀둥이', owner: '소파(박수오)' },
  'U0AP0PWMGH1': { name: '뽀식이', owner: '타타' },
  'U0AQHLZHRQQ': { name: '시고르', owner: '최병찬' },
  'U0AP72SN150': { name: '두가경', owner: '한가경' },
  'U0AJM9ABCFQ': { name: '볼카', owner: '조재호' },
  'U0AGD0T3PNH': { name: '주대리', owner: '김소연' },
  'U0APAB01C92': { name: 'Friday', owner: '현진우' },
  'U0AP0K28QJX': { name: '츄', owner: '김태현' },
  'U0ANRJJHP71': { name: '죠죠', owner: '한솔' },
  'U0AP0U9G3C3': { name: '콘스터', owner: '김소연' },
  'U0AP97XLFA6': { name: '김실장', owner: '한가경' },
  'U0AB8QE1YLR': { name: 'Jarvis', owner: '현진우' },
  'U09US3BPW9F': { name: '비투비서', owner: '한가경' },
};

const isBot = id => !!BOT_IDS[id];
const botName = id => BOT_IDS[id]?.name || id;

// ============================================================
// 1. ERROR DETECTION
// Based on Higashinaka et al. (2021) error taxonomy, adapted
// for OpenClaw Slack bot context
// ============================================================

function classifyError(text, msg = {}) {
  // Empty text with file attachments = file sharing, NOT an error
  if (!text || text.trim().length === 0) {
    if (msg.files?.length || msg.attachments?.length || msg.blocks?.length) return null;
    return 'empty_response';
  }

  // OpenClaw gateway-specific errors (:warning: prefix)
  if (text.startsWith(':warning:')) {
    if (/overloaded/i.test(text)) return 'ai_overloaded';
    if (/All models failed/i.test(text)) return 'model_failed';
    if (/Unknown model/i.test(text)) return 'unknown_model';
    if (/rate.?limit|Rate-limited/i.test(text)) return 'rate_limit';
    if (/usage limit|ChatGPT/i.test(text)) return 'usage_limit';
    if (/Something went wrong/i.test(text)) return 'generic_error';
    return 'other_warning';
  }

  // Timeout patterns
  if (/timed?\s*out|timeout/i.test(text)) return 'timeout';

  // Request timed out (OpenClaw specific)
  if (/Request timed out before/i.test(text)) return 'timeout';

  return null; // Not an error
}

// Error type → category mapping
const ERROR_CATEGORIES = {
  timeout: 'infrastructure',
  ai_overloaded: 'infrastructure',
  model_failed: 'infrastructure',
  unknown_model: 'infrastructure',
  rate_limit: 'capacity',
  usage_limit: 'capacity',
  generic_error: 'infrastructure',
  other_warning: 'infrastructure',
  empty_response: 'content',
};

// ============================================================
// 2. BEHAVIORAL PROXY METRICS
// Based on Jiang et al. (2015) and PARADISE (Walker et al. 1997)
// ============================================================

// Positive reaction emojis
const POSITIVE_REACTIONS = new Set([
  'thumbsup', '+1', 'heart', 'tada', 'fire', '100', 'clap',
  'raised_hands', 'star', 'rocket', 'muscle', 'pray', 'sparkles',
  'white_check_mark', 'heavy_check_mark', 'ok_hand',
]);

// Negative reaction emojis
const NEGATIVE_REACTIONS = new Set([
  'thumbsdown', '-1', 'confused', 'disappointed', 'angry',
  'no_entry', 'x', 'warning',
]);

function classifyReactions(reactions) {
  if (!reactions || reactions.length === 0) return { positive: 0, negative: 0, neutral: 0, total: 0 };
  let positive = 0, negative = 0, neutral = 0;
  for (const r of reactions) {
    if (POSITIVE_REACTIONS.has(r.name)) positive += r.count;
    else if (NEGATIVE_REACTIONS.has(r.name)) negative += r.count;
    else neutral += r.count;
  }
  return { positive, negative, neutral, total: positive + negative + neutral };
}

// Follow-up valence: classify human's response after bot message
function classifyFollowUp(text) {
  if (!text) return 'none';
  const t = text.toLowerCase();

  // Positive signals
  if (/감사|고마워|고맙|ㄱㅅ|ㅋㅋ|ㅎㅎ|잘했|좋아|완벽|정확|맞아|오[!~]|훌륭|대박|잘\s*됐/.test(t)) return 'positive';
  if (/thanks|thank you|perfect|great|awesome|nice/i.test(t)) return 'positive';

  // Negative signals (re-request or correction)
  if (/아니[야요]|아닌데|틀렸|그게\s*아니|잘못|다시\s*(해|말|찾|확인|알려)|아냐|안\s*맞/.test(t)) return 'negative';
  if (/wrong|no[,.]|incorrect|not what/i.test(t)) return 'negative';

  // Continuation (neutral — new request or follow-up)
  return 'neutral';
}

// ============================================================
// 3. THREAD-LEVEL ANALYSIS
// ============================================================

function analyzeThread(parentMsg, replies, channelName) {
  if (!replies || replies.length === 0) return null;

  const allMessages = [parentMsg, ...replies];
  const turns = [];

  for (const m of allMessages) {
    turns.push({
      user: m.user,
      isBot: isBot(m.user),
      text: m.text || '',
      ts: parseFloat(m.ts),
      reactions: m.reactions || [],
      error: isBot(m.user) ? classifyError(m.text || '', m) : null,
    });
  }

  // Find bot-human interaction patterns
  const botTurns = turns.filter(t => t.isBot);
  const humanTurns = turns.filter(t => !t.isBot);

  if (botTurns.length === 0) return null;

  // Determine thread initiator
  const initiator = turns[0].isBot ? 'bot' : 'human';

  // For each bot response, check what human does next
  const botResponseOutcomes = [];
  for (let i = 0; i < turns.length; i++) {
    if (!turns[i].isBot) continue;
    if (turns[i].error) continue; // Skip error messages for quality assessment

    // Find next human message after this bot message
    let nextHuman = null;
    for (let j = i + 1; j < turns.length; j++) {
      if (!turns[j].isBot) {
        nextHuman = turns[j];
        break;
      }
    }

    const reactionInfo = classifyReactions(turns[i].reactions);
    const followUp = nextHuman ? classifyFollowUp(nextHuman.text) : 'abandoned';

    botResponseOutcomes.push({
      botId: turns[i].user,
      followUp,
      hasReaction: reactionInfo.total > 0,
      reactionSentiment: reactionInfo.positive > reactionInfo.negative ? 'positive' :
        reactionInfo.negative > reactionInfo.positive ? 'negative' : 'neutral',
      reactionCounts: reactionInfo,
      responseLength: turns[i].text.length,
      timeSinceRequest: i > 0 ? turns[i].ts - turns[i - 1].ts : 0,
    });
  }

  // Thread-level metrics
  const errorCount = botTurns.filter(t => t.error).length;
  const totalBotMessages = botTurns.length;
  const lastMessage = turns[turns.length - 1];
  const threadAbandoned = lastMessage.isBot && humanTurns.length > 0 && turns.length > 2;

  return {
    channel: channelName,
    threadTs: parentMsg.ts,
    initiator,
    totalTurns: turns.length,
    botTurns: totalBotMessages,
    humanTurns: humanTurns.length,
    errorCount,
    errorRate: totalBotMessages > 0 ? errorCount / totalBotMessages : 0,
    threadAbandoned,
    botResponseOutcomes,
    errors: botTurns.filter(t => t.error).map(t => ({
      botId: t.user,
      type: t.error,
      category: ERROR_CATEGORIES[t.error] || 'unknown',
    })),
  };
}

// ============================================================
// 4. MAIN ANALYSIS
// ============================================================

function analyze() {
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== '_discovery.json');
  console.log(`Loading ${files.length} channel files...`);

  // Per-bot quality metrics
  const botQuality = {};
  for (const [id, info] of Object.entries(BOT_IDS)) {
    botQuality[id] = {
      name: info.name,
      owner: info.owner,
      totalMessages: 0,
      // Error metrics
      errors: { total: 0, byType: {}, byCategory: {} },
      // Behavioral metrics
      threadParticipation: 0,
      outcomes: { positive: 0, negative: 0, neutral: 0, abandoned: 0, none: 0 },
      reactions: { positive: 0, negative: 0, neutral: 0, total: 0 },
      // Thread metrics
      threadsWithErrors: 0,
      avgResponseLength: 0,
      responseLengths: [],
    };
  }

  // Global thread analysis
  const allThreads = [];
  const validationSample = []; // For reliability check
  let totalBotMessages = 0;

  for (const file of files) {
    let data;
    try {
      data = JSON.parse(readFileSync(`${DATA_DIR}/${file}`, 'utf-8'));
    } catch { continue; }

    const channelName = data.channel?.name || file.replace('.json', '');
    const messages = data.messages || [];

    for (const msg of messages) {
      const userId = msg.user;
      if (!userId) continue;

      // Count bot messages and detect errors (top-level)
      if (isBot(userId) && botQuality[userId]) {
        totalBotMessages++;
        const errType = classifyError(msg.text || '', msg);
        if (errType) {
          botQuality[userId].errors.total++;
          botQuality[userId].errors.byType[errType] = (botQuality[userId].errors.byType[errType] || 0) + 1;
          const cat = ERROR_CATEGORIES[errType] || 'unknown';
          botQuality[userId].errors.byCategory[cat] = (botQuality[userId].errors.byCategory[cat] || 0) + 1;
        }
        botQuality[userId].totalMessages++;
        botQuality[userId].responseLengths.push((msg.text || '').length);

        // Reactions on bot messages
        const rcls = classifyReactions(msg.reactions);
        botQuality[userId].reactions.positive += rcls.positive;
        botQuality[userId].reactions.negative += rcls.negative;
        botQuality[userId].reactions.neutral += rcls.neutral;
        botQuality[userId].reactions.total += rcls.total;
      }

      // Count bot messages in replies
      if (msg._replies) {
        for (const reply of msg._replies) {
          if (isBot(reply.user) && botQuality[reply.user]) {
            totalBotMessages++;
            const errType = classifyError(reply.text || '', reply);
            if (errType) {
              botQuality[reply.user].errors.total++;
              botQuality[reply.user].errors.byType[errType] = (botQuality[reply.user].errors.byType[errType] || 0) + 1;
              const cat = ERROR_CATEGORIES[errType] || 'unknown';
              botQuality[reply.user].errors.byCategory[cat] = (botQuality[reply.user].errors.byCategory[cat] || 0) + 1;
            }
            botQuality[reply.user].totalMessages++;
            botQuality[reply.user].responseLengths.push((reply.text || '').length);

            const rcls = classifyReactions(reply.reactions);
            botQuality[reply.user].reactions.positive += rcls.positive;
            botQuality[reply.user].reactions.negative += rcls.negative;
            botQuality[reply.user].reactions.neutral += rcls.neutral;
            botQuality[reply.user].reactions.total += rcls.total;
          }
        }
      }

      // Thread-level analysis (only for threads with bot participation)
      if (msg._replies && msg._replies.length > 0) {
        const allInThread = [msg, ...msg._replies];
        const hasBotInThread = allInThread.some(m => isBot(m.user));
        if (!hasBotInThread) continue;

        const threadResult = analyzeThread(msg, msg._replies, channelName);
        if (threadResult) {
          allThreads.push(threadResult);

          // Update per-bot outcomes
          for (const outcome of threadResult.botResponseOutcomes) {
            if (botQuality[outcome.botId]) {
              botQuality[outcome.botId].outcomes[outcome.followUp]++;
              botQuality[outcome.botId].threadParticipation++;
            }
          }

          if (threadResult.errorCount > 0) {
            for (const err of threadResult.errors) {
              if (botQuality[err.botId]) {
                botQuality[err.botId].threadsWithErrors++;
              }
            }
          }

          // Collect validation sample (stratified random)
          if (validationSample.length < 200 && Math.random() < 0.35) {
            for (const outcome of threadResult.botResponseOutcomes.slice(0, 1)) {
              validationSample.push({
                channel: channelName,
                threadTs: threadResult.threadTs,
                botId: outcome.botId,
                botName: botName(outcome.botId),
                autoClassification: outcome.followUp,
                responseLength: outcome.responseLength,
                // For human validation
                _validate: 'followUp classification correct? (positive/negative/neutral/abandoned)',
              });
            }
          }
        }
      }
    }
  }

  // === Compute Derived Metrics ===
  const botScorecard = [];
  for (const [id, q] of Object.entries(botQuality)) {
    if (q.totalMessages === 0) continue;

    // Average response length
    q.avgResponseLength = q.responseLengths.length > 0
      ? Math.round(q.responseLengths.reduce((a, b) => a + b, 0) / q.responseLengths.length)
      : 0;
    delete q.responseLengths;

    // Error rate
    const errorRate = q.totalMessages > 0 ? q.errors.total / q.totalMessages : 0;

    // Outcome rates (from thread behavioral analysis)
    const totalOutcomes = q.outcomes.positive + q.outcomes.negative + q.outcomes.neutral + q.outcomes.abandoned;
    const positiveRate = totalOutcomes > 0 ? q.outcomes.positive / totalOutcomes : 0;
    const negativeRate = totalOutcomes > 0 ? q.outcomes.negative / totalOutcomes : 0;
    const abandonRate = totalOutcomes > 0 ? q.outcomes.abandoned / totalOutcomes : 0;

    // Reaction rate
    const reactionRate = q.totalMessages > 0 ? q.reactions.total / q.totalMessages : 0;
    const reactionSentiment = q.reactions.total > 0
      ? (q.reactions.positive - q.reactions.negative) / q.reactions.total
      : 0;

    // Behavioral Quality Index (BQI)
    // Weighted composite: higher = better quality
    // Formula: BQI = 0.3*(1-errorRate) + 0.25*(positiveRate) + 0.25*(1-abandonRate) + 0.2*(reactionSentiment normalized to 0-1)
    const bqi = (
      0.30 * (1 - Math.min(errorRate, 1)) +
      0.25 * positiveRate +
      0.25 * (1 - abandonRate) +
      0.20 * ((reactionSentiment + 1) / 2) // normalize -1~1 to 0~1
    );

    botScorecard.push({
      botId: id,
      name: q.name,
      owner: q.owner,
      totalMessages: q.totalMessages,
      // Error metrics
      errorCount: q.errors.total,
      errorRate: Math.round(errorRate * 1000) / 10, // percentage with 1 decimal
      errorsByType: q.errors.byType,
      errorsByCategory: q.errors.byCategory,
      // Behavioral metrics
      threadResponses: totalOutcomes,
      outcomeDistribution: {
        positive: q.outcomes.positive,
        negative: q.outcomes.negative,
        neutral: q.outcomes.neutral,
        abandoned: q.outcomes.abandoned,
      },
      positiveRate: Math.round(positiveRate * 1000) / 10,
      negativeRate: Math.round(negativeRate * 1000) / 10,
      abandonRate: Math.round(abandonRate * 1000) / 10,
      // Reaction metrics
      totalReactions: q.reactions.total,
      reactionRate: Math.round(reactionRate * 1000) / 10,
      reactionSentiment: Math.round(reactionSentiment * 100) / 100,
      reactionBreakdown: { positive: q.reactions.positive, negative: q.reactions.negative, neutral: q.reactions.neutral },
      // Response quality
      avgResponseLength: q.avgResponseLength,
      // Composite score
      bqi: Math.round(bqi * 100) / 100,
    });
  }

  // Sort by total messages (descending)
  botScorecard.sort((a, b) => b.totalMessages - a.totalMessages);

  // === Thread Summary ===
  const threadSummary = {
    totalThreadsWithBots: allThreads.length,
    threadsWithErrors: allThreads.filter(t => t.errorCount > 0).length,
    abandonedThreads: allThreads.filter(t => t.threadAbandoned).length,
    avgTurnsPerThread: allThreads.length > 0
      ? Math.round(allThreads.reduce((s, t) => s + t.totalTurns, 0) / allThreads.length * 10) / 10
      : 0,
    initiatorDistribution: {
      human: allThreads.filter(t => t.initiator === 'human').length,
      bot: allThreads.filter(t => t.initiator === 'bot').length,
    },
  };

  // === Error Summary ===
  const errorSummary = {
    totalErrors: botScorecard.reduce((s, b) => s + b.errorCount, 0),
    totalBotMessages,
    overallErrorRate: Math.round(botScorecard.reduce((s, b) => s + b.errorCount, 0) / totalBotMessages * 1000) / 10,
    byType: {},
    byCategory: { infrastructure: 0, capacity: 0, content: 0 },
  };
  for (const b of botScorecard) {
    for (const [type, count] of Object.entries(b.errorsByType)) {
      errorSummary.byType[type] = (errorSummary.byType[type] || 0) + count;
    }
    for (const [cat, count] of Object.entries(b.errorsByCategory)) {
      errorSummary.byCategory[cat] = (errorSummary.byCategory[cat] || 0) + count;
    }
  }

  // === Output ===
  const result = {
    analyzedAt: new Date().toISOString(),
    period: { from: '2026-03-27', to: '2026-04-07' },
    methodology: {
      errorDetection: 'Strict pattern matching on OpenClaw gateway error messages (:warning: prefix) + timeout/empty detection',
      behavioralProxies: 'Thread-level analysis: follow-up valence (Jiang et al. 2015), abandonment, reaction sentiment',
      qualityIndex: 'BQI = 0.3*(1-errorRate) + 0.25*(positiveRate) + 0.25*(1-abandonRate) + 0.2*(reactionSentiment)',
      framework: 'PARADISE (Walker et al. 1997) adapted for async Slack context',
    },
    errorSummary,
    threadSummary,
    botScorecard,
    validationSample: validationSample.slice(0, 200),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/quality-analysis.json`, JSON.stringify(result, null, 2));
  console.log(`\n✅ Quality analysis saved to ${OUT_DIR}/quality-analysis.json`);

  // === Print Report ===
  console.log('\n' + '='.repeat(60));
  console.log('  봇 응답 품질 분석 결과');
  console.log('='.repeat(60));

  console.log(`\n📊 전체 현황`);
  console.log(`  총 봇 메시지: ${totalBotMessages.toLocaleString()}건`);
  console.log(`  총 에러: ${errorSummary.totalErrors}건 (${errorSummary.overallErrorRate}%)`);
  console.log(`  봇 참여 스레드: ${threadSummary.totalThreadsWithBots}개`);
  console.log(`  에러 발생 스레드: ${threadSummary.threadsWithErrors}개`);

  console.log(`\n🔴 에러 유형별 분포`);
  Object.entries(errorSummary.byType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => console.log(`  ${count}건  ${type} [${ERROR_CATEGORIES[type]}]`));

  console.log(`\n📋 봇별 품질 점수표 (BQI = Behavioral Quality Index)`);
  console.log(`${'봇'.padEnd(10)} ${'메시지'.padStart(6)} ${'에러'.padStart(5)} ${'에러율'.padStart(6)} ${'긍정'.padStart(5)} ${'부정'.padStart(5)} ${'이탈'.padStart(5)} ${'BQI'.padStart(5)}`);
  console.log('-'.repeat(55));
  for (const b of botScorecard) {
    console.log(
      `${b.name.padEnd(10)} ${String(b.totalMessages).padStart(6)} ` +
      `${String(b.errorCount).padStart(5)} ${(b.errorRate + '%').padStart(6)} ` +
      `${(b.positiveRate + '%').padStart(5)} ${(b.negativeRate + '%').padStart(5)} ` +
      `${(b.abandonRate + '%').padStart(5)} ${String(b.bqi).padStart(5)}`
    );
  }

  console.log(`\n🎯 품질 등급 (BQI 기준)`);
  const excellent = botScorecard.filter(b => b.bqi >= 0.7);
  const good = botScorecard.filter(b => b.bqi >= 0.5 && b.bqi < 0.7);
  const poor = botScorecard.filter(b => b.bqi < 0.5);
  if (excellent.length) console.log(`  ⭐ 우수 (≥0.7): ${excellent.map(b => b.name).join(', ')}`);
  if (good.length) console.log(`  ✅ 양호 (0.5~0.7): ${good.map(b => b.name).join(', ')}`);
  if (poor.length) console.log(`  ⚠️  개선필요 (<0.5): ${poor.map(b => b.name).join(', ')}`);

  console.log(`\n📝 검증용 표본: ${validationSample.length}건 추출 (quality-analysis.json 내 validationSample)`);
}

analyze();
