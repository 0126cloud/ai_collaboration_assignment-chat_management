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

// 生成 2 秒黑底白字標題卡（ImageMagick + ffmpeg）
function createTitleCard(title: string, outputPath: string): void {
  const pngPath = outputPath.replace('.mp4', '.png');
  try {
    // 黑底白字置中 PNG，尺寸與測試影片相同（1920x1080）
    execSync(
      `${MAGICK_CMD} -size 1920x1080 xc:black ` +
        `-fill white -font "${FONT}" -pointsize 72 ` +
        `-gravity Center -annotate 0 "${escapeIMText(title)}" "${pngPath}"`,
      { stdio: 'pipe' },
    );
    // PNG 轉 2 秒影片
    execSync(
      `ffmpeg -y -loop 1 -i "${pngPath}" -t 2 -r 25 -c:v libx264 -pix_fmt yuv420p "${outputPath}"`,
      { stdio: 'pipe' },
    );
  } finally {
    if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
  }
}

// WebM 轉 MP4 並燒入字幕（ImageMagick 生成字幕條 + ffmpeg overlay）
function convertWithSubtitle(
  webmPath: string,
  subtitle: string,
  status: string,
  outputPath: string,
): void {
  const statusIcon = status === 'passed' ? '✓' : '✗';
  const text = `${statusIcon} ${subtitle}`;
  const pngPath = outputPath.replace('.mp4', '_sub.png');
  try {
    // 半透明黑底白字字幕條（寬度略小於影片寬度 1920px）
    execSync(
      `${MAGICK_CMD} -size 1880x56 xc:"rgba(0,0,0,153)" ` +
        `-fill white -font "${FONT}" -pointsize 36 ` +
        `-gravity West -annotate +16+0 "${escapeIMText(text)}" "${pngPath}"`,
      { stdio: 'pipe' },
    );
    // 疊加字幕條至影片右下角上方
    execSync(
      `ffmpeg -y -i "${webmPath}" -i "${pngPath}" ` +
        `-filter_complex "[0:v][1:v]overlay=20:H-h-20" ` +
        `-c:v libx264 -c:a aac "${outputPath}"`,
      { stdio: 'pipe' },
    );
  } finally {
    if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
  }
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

    // 各 test 片段
    for (const result of suiteResults) {
      if (!result.webmPath) {
        console.warn(`   ⚠️  ${result.testName} 無影片，跳過`);
        continue;
      }

      const segPath = path.join(TEMP_DIR, `seg_${segIndex++}.mp4`);
      console.log(`   ${result.status === 'passed' ? '✅' : '❌'} ${result.testName}`);
      try {
        convertWithSubtitle(result.webmPath, result.testName, result.status, segPath);
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
    `ffmpeg -y -f concat -safe 0 -i "${concatListPath}" -c:v libx264 -c:a aac "${outputPath}"`,
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
