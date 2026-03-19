import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const E2E_DIR = path.resolve(__dirname, '..');
const RESULTS_JSON = path.join(E2E_DIR, 'test-results', 'results.json');
const OUTPUT_DIR = path.join(E2E_DIR, 'output');
const TEMP_DIR = path.join(OUTPUT_DIR, 'tmp');

// ffmpeg 安裝確認
function checkFfmpeg(): void {
  const result = spawnSync('which', ['ffmpeg']);
  if (result.status !== 0) {
    console.error('❌ ffmpeg 未安裝，請先安裝：');
    console.error('   macOS:  brew install ffmpeg');
    console.error('   Ubuntu: sudo apt install ffmpeg');
    process.exit(1);
  }
}

interface TestResult {
  suiteName: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  webmPath: string | null;
}

// 解析 results.json，取出各 test 的資訊
function parseResults(): TestResult[] {
  if (!fs.existsSync(RESULTS_JSON)) {
    console.error(`❌ 找不到 ${RESULTS_JSON}，請先執行 npm run test:e2e`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(RESULTS_JSON, 'utf-8'));
  const results: TestResult[] = [];

  for (const fileSuite of data.suites ?? []) {
    for (const describeSuite of fileSuite.suites ?? []) {
      const suiteName: string = describeSuite.title ?? '';
      for (const spec of describeSuite.specs ?? []) {
        const testName: string = spec.title ?? '';
        const testResult = spec.tests?.[0]?.results?.[0];
        const status = testResult?.status ?? 'skipped';

        // 找對應的 video.webm
        let webmPath: string | null = null;
        const attachments: Array<{ name: string; path: string }> = testResult?.attachments ?? [];
        const videoAttachment = attachments.find((a) => a.name === 'video');
        if (videoAttachment?.path && fs.existsSync(videoAttachment.path)) {
          webmPath = videoAttachment.path;
        }

        results.push({ suiteName, testName, status, webmPath });
      }
    }
  }

  return results;
}

// ImageMagick v7 指令
const MAGICK_CMD = 'magick';
// 支援中文的字型（Arial Unicode 含 CJK，macOS 內建）
const FONT = '/System/Library/Fonts/Supplemental/Arial Unicode.ttf';

// 逸出 ImageMagick annotate 文字
function escapeIMText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

// 生成標題卡（ImageMagick + ffmpeg）
// style: 'dark' = 黑底白字（模組標題）、'light' = 白底黑字（測試標題）
function createTitleCard(
  title: string,
  outputPath: string,
  style: 'dark' | 'light' = 'dark',
): void {
  const pngPath = outputPath.replace('.mp4', '.png');
  const bg = style === 'dark' ? 'black' : 'white';
  const fg = style === 'dark' ? 'white' : 'black';
  const duration = style === 'dark' ? 2 : 2.5;
  try {
    execSync(
      `${MAGICK_CMD} -size 1920x1080 xc:${bg} ` +
        `-fill ${fg} -font "${FONT}" -pointsize 72 ` +
        `-gravity Center -annotate 0 "${escapeIMText(title)}" "${pngPath}"`,
      { stdio: 'pipe' },
    );
    execSync(
      `ffmpeg -y -loop 1 -i "${pngPath}" -t ${duration} -r 30 -c:v libx264 -crf 18 -pix_fmt yuv420p "${outputPath}"`,
      { stdio: 'pipe' },
    );
  } finally {
    if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
  }
}

// WebM 轉 MP4（tpad 凍結首尾幀，固定 30fps + 高品質）
function convertToMp4(webmPath: string, outputPath: string): void {
  execSync(
    `ffmpeg -y -i "${webmPath}" ` +
      `-vf "tpad=start_duration=1:stop_duration=2:start_mode=clone:stop_mode=clone" ` +
      `-r 30 -c:v libx264 -crf 18 -preset slow -c:a aac "${outputPath}"`,
    { stdio: 'pipe' },
  );
}

// 主流程
async function main(): Promise<void> {
  checkFfmpeg();

  console.log('📖 讀取測試結果...');
  const results = parseResults();
  console.log(`   找到 ${results.length} 個測試`);

  // 建立輸出目錄
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  const segments: string[] = [];
  let segIndex = 0;

  // 按 suiteName 分組，插入標題卡
  const suiteOrder: string[] = [];
  for (const r of results) {
    if (!suiteOrder.includes(r.suiteName)) {
      suiteOrder.push(r.suiteName);
    }
  }

  for (const suiteName of suiteOrder) {
    const suiteResults = results.filter((r) => r.suiteName === suiteName);

    // 插入 2 秒模組標題卡
    const titleCardPath = path.join(TEMP_DIR, `title_${segIndex++}.mp4`);
    console.log(`🎬 生成標題卡：${suiteName}`);
    try {
      createTitleCard(suiteName, titleCardPath);
      segments.push(titleCardPath);
    } catch (e) {
      console.warn(`   ⚠️  標題卡生成失敗，跳過：${e}`);
    }

    // 各 test 片段：先插入白底黑字標題卡，再接測試影片
    for (const result of suiteResults) {
      if (!result.webmPath) {
        console.warn(`   ⚠️  ${result.testName} 無影片，跳過`);
        continue;
      }

      const statusIcon = result.status === 'passed' ? '✓' : '✗';
      const cardText = `${statusIcon} ${result.testName}`;
      console.log(`   ${result.status === 'passed' ? '✅' : '❌'} ${result.testName}`);

      // 白底黑字標題卡
      const testTitlePath = path.join(TEMP_DIR, `test_title_${segIndex++}.mp4`);
      try {
        createTitleCard(cardText, testTitlePath, 'light');
        segments.push(testTitlePath);
      } catch (e) {
        console.warn(`   ⚠️  測試標題卡生成失敗，跳過：${e}`);
      }

      // 測試影片
      const segPath = path.join(TEMP_DIR, `seg_${segIndex++}.mp4`);
      try {
        convertToMp4(result.webmPath, segPath);
        segments.push(segPath);
      } catch (e) {
        console.warn(`   ⚠️  轉換失敗，跳過：${e}`);
      }
    }
  }

  if (segments.length === 0) {
    console.error('❌ 沒有可用的影片片段');
    process.exit(1);
  }

  // 生成 concat list
  const concatListPath = path.join(TEMP_DIR, 'concat.txt');
  const concatContent = segments.map((s) => `file '${s}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent);

  // 合成最終影片
  const outputPath = path.join(OUTPUT_DIR, 'demo.mp4');
  console.log('\n🎞️  合成最終影片...');
  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -r 30 -c:v libx264 -crf 18 -preset slow -c:a aac "${outputPath}"`,
    { stdio: 'pipe' },
  );

  // 清理暫存
  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  const stat = fs.statSync(outputPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
  console.log(`\n✅ 完成！輸出：${outputPath} (${sizeMB} MB)`);
}

main().catch((err) => {
  console.error('❌ 錯誤：', err);
  process.exit(1);
});
