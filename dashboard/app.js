const defaultDataUrl = './data.json';
const refreshMinutesParam = new URLSearchParams(window.location.search).get('refreshMinutes');
const refreshIntervalMs = Math.max(parseInt(refreshMinutesParam || '30', 10), 5) * 60 * 1000;

let dataCache = null;
let charts = {};

const formatNumber = (num, options = {}) => num.toLocaleString(undefined, options);

const getDataUrl = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('dataUrl') || defaultDataUrl;
};

const setDataHint = (url, updatedAt) => {
  const hint = document.getElementById('data-hint');
  const sourceLink = document.getElementById('open-source');
  const lastUpdated = document.getElementById('last-updated');
  sourceLink.href = url;
  hint.textContent = `Live source: ${url}. Auto-refresh every ${refreshIntervalMs / 60000} minutes.`;
  lastUpdated.textContent = `Updated: ${updatedAt || '—'}`;
};

async function loadData() {
  const url = getDataUrl();
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    throw new Error(`Failed to load data from ${url}`);
  }
  const payload = await res.json();
  setDataHint(url, payload.metadata?.updatedAt);
  return payload;
}

function buildTable(tableId, columns, rows) {
  const table = document.getElementById(tableId);
  const thead = `<thead><tr>${columns.map((col) => `<th>${col.label}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${rows
    .map((row) => `<tr>${columns.map((col) => `<td>${row[col.key] ?? ''}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  table.innerHTML = `${thead}${tbody}`;
}

function buildField({ label, id, type = 'number', value, step, min, max, options }) {
  if (type === 'select') {
    return `
      <div class="field">
        <label for="${id}">${label}</label>
        <select id="${id}">
          ${options.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join('')}
        </select>
      </div>
    `;
  }

  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <input id="${id}" type="${type}" value="${value}" ${step ? `step="${step}"` : ''} ${min ? `min="${min}"` : ''} ${
        max ? `max="${max}"` : ''
      } />
    </div>
  `;
}

function renderStats(data) {
  const stats = [];
  const newest = data.gpuSpecifications.reduce((latest, gpu) => (gpu.launchYear > latest.launchYear ? gpu : latest), data.gpuSpecifications[0]);
  stats.push({
    title: 'Freshest silicon',
    value: newest.architecture,
    delta: `Launch ${newest.launchYear}`,
  });

  const lowestCloud = data.cloudPricing.reduce((min, item) => (item.pricePerGpuHour < min.pricePerGpuHour ? item : min), data.cloudPricing[0]);
  stats.push({
    title: 'Cloud price floor',
    value: `$${lowestCloud.pricePerGpuHour.toFixed(2)}/GPU-hr`,
    delta: lowestCloud.provider,
  });

  const fastestInference = data.inferencePerformance.reduce((max, row) =>
    row.tokensPerSecondB200Fp4 > max.tokensPerSecondB200Fp4 ? row : max
  , data.inferencePerformance[0]);
  stats.push({
    title: 'Top throughput (B200 FP4)',
    value: `${formatNumber(fastestInference.tokensPerSecondB200Fp4)} tok/s`,
    delta: fastestInference.model,
  });

  const latestMarket = data.marketForecast[data.marketForecast.length - 1];
  stats.push({
    title: '2032 GPU rental TAM',
    value: `$${latestMarket.gpuRentalMarketB.toFixed(2)}B`,
    delta: 'Incl. hyperscaler demand ramp',
  });

  document.getElementById('stat-grid').innerHTML = stats
    .map(
      (stat) => `
      <div class="stat">
        <h3>${stat.title}</h3>
        <div class="value">${stat.value}</div>
        <div class="delta">${stat.delta}</div>
      </div>
    `
    )
    .join('');
}

function renderGpuSection(data) {
  buildTable(
    'gpu-table',
    [
      { key: 'architecture', label: 'Architecture' },
      { key: 'launchYear', label: 'Launch' },
      { key: 'fp16', label: 'FP16 TFLOPS' },
      { key: 'fp8', label: 'FP8 TFLOPS' },
      { key: 'memory', label: 'Memory (GB)' },
      { key: 'bandwidth', label: 'BW (TB/s)' },
      { key: 'tdp', label: 'TDP (W)' },
      { key: 'pricing', label: 'Price Range' },
      { key: 'rental', label: 'Cloud ($/hr)' },
      { key: 'tokens', label: 'Tokens/s' },
    ],
    data.gpuSpecifications.map((gpu) => ({
      architecture: `<strong>${gpu.architecture}</strong>`,
      launchYear: gpu.launchYear,
      fp16: formatNumber(gpu.fp16Tflops),
      fp8: formatNumber(gpu.fp8Tflops),
      memory: gpu.memoryGb,
      bandwidth: gpu.memoryBandwidthTbs.toFixed(2),
      tdp: gpu.tdpWatts,
      pricing: `$${formatNumber(gpu.purchasePriceLow)} – $${formatNumber(gpu.purchasePriceHigh)}`,
      rental: `$${gpu.cloudRentalLow.toFixed(2)} – $${gpu.cloudRentalHigh.toFixed(2)}`,
      tokens: formatNumber(gpu.tokensPerSec),
    }))
  );

  if (charts.gpu) charts.gpu.destroy();
  charts.gpu = new Chart(document.getElementById('gpu-chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: data.gpuSpecifications.map((g) => g.architecture),
      datasets: [
        {
          label: 'FP16 TFLOPS',
          data: data.gpuSpecifications.map((g) => g.fp16Tflops),
          backgroundColor: 'rgba(124, 93, 255, 0.7)',
        },
        {
          label: 'Memory (GB)',
          data: data.gpuSpecifications.map((g) => g.memoryGb),
          backgroundColor: 'rgba(39, 211, 162, 0.7)',
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, title: { display: true, text: 'TFLOPS' } },
        y1: { beginAtZero: true, position: 'right', title: { display: true, text: 'Memory (GB)' }, grid: { drawOnChartArea: false } },
      },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

function renderCloudSection(data) {
  buildTable(
    'cloud-table',
    [
      { key: 'provider', label: 'Provider' },
      { key: 'gpu', label: 'GPU Type' },
      { key: 'price', label: 'Price ($/GPU-hr)' },
      { key: 'config', label: 'Config' },
      { key: 'availability', label: 'Availability' },
    ],
    data.cloudPricing.map((row) => ({
      provider: `<strong>${row.provider}</strong>` ,
      gpu: row.gpuType,
      price: `$${row.pricePerGpuHour.toFixed(2)}`,
      config: row.config,
      availability: row.availability,
    }))
  );

  if (charts.cloud) charts.cloud.destroy();
  charts.cloud = new Chart(document.getElementById('cloud-chart').getContext('2d'), {
    type: 'bar',
    data: {
      labels: data.cloudPricing.map((p) => p.provider),
      datasets: [
        {
          label: 'Price per GPU-hour ($)',
          data: data.cloudPricing.map((p) => p.pricePerGpuHour),
          backgroundColor: data.cloudPricing.map((p) => (p.pricePerGpuHour <= 3 ? 'rgba(39,211,162,0.7)' : 'rgba(124,93,255,0.7)')),
        },
      ],
    },
    options: { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } },
  });

  document.getElementById('export-cloud').onclick = () => exportTableAsCsv('cloud-table', 'cloud-pricing.csv');
}

function renderTrainingSection(data) {
  const modelOptions = data.trainingCosts.map((m) => ({ value: m.modelSize, label: `${m.modelSize} params` }));
  const gpuOptions = [
    { value: 'A100', label: 'A100 80GB' },
    { value: 'H100', label: 'H100 80GB' },
    { value: 'B200', label: 'B200' },
  ];
  const precisionOptions = [
    { value: 'FP16', label: 'FP16' },
    { value: 'FP8', label: 'FP8 (1.5x on large models)' },
    { value: 'FP4', label: 'FP4 (2-3x on Blackwell)' },
  ];

  document.getElementById('training-form').innerHTML = [
    buildField({ label: 'Model size', id: 'training-model', type: 'select', options: modelOptions }),
    buildField({ label: 'GPU type', id: 'training-gpu', type: 'select', options: gpuOptions }),
    buildField({ label: 'GPU count', id: 'training-count', value: 8, min: 1 }),
    buildField({ label: 'GPU hourly cost ($)', id: 'training-cost', value: 2.4, step: 0.01, min: 0 }),
    buildField({ label: 'Precision', id: 'training-precision', type: 'select', options: precisionOptions }),
  ].join('');

  const render = () => {
    const modelSize = document.getElementById('training-model').value;
    const gpuType = document.getElementById('training-gpu').value;
    const gpuCount = parseFloat(document.getElementById('training-count').value);
    const gpuCost = parseFloat(document.getElementById('training-cost').value);
    const precision = document.getElementById('training-precision').value;

    const row = data.trainingCosts.find((m) => m.modelSize === modelSize);
    let baseHours = gpuType === 'A100' ? row.trainingGpuHoursA100 : row.trainingGpuHoursH100;
    if (precision === 'FP8') baseHours = baseHours / row.fp8Speedup;
    if (precision === 'FP4' && gpuType === 'B200') baseHours = baseHours / row.fp4SpeedupBlackwell;

    const totalGpuHours = baseHours;
    const wallClockHours = totalGpuHours / gpuCount;
    const totalCost = totalGpuHours * gpuCost;

    document.getElementById('training-result').innerHTML = `
      <h3>Training cost</h3>
      <div class="result-grid">
        <div class="result-item"><strong>Total GPU-hours</strong><div>${formatNumber(totalGpuHours)}</div></div>
        <div class="result-item"><strong>Wall-clock</strong><div>${formatNumber(wallClockHours, { maximumFractionDigits: 0 })} hours</div></div>
        <div class="result-item"><strong>Cost</strong><div>$${formatNumber(totalCost, { maximumFractionDigits: 0 })}</div></div>
        <div class="result-item"><strong>Cluster burn</strong><div>$${(gpuCount * gpuCost).toFixed(2)}/hr</div></div>
      </div>
    `;
  };

  document.getElementById('run-training').onclick = render;
  render();

  buildTable(
    'training-table',
    [
      { key: 'model', label: 'Model size' },
      { key: 'a100', label: 'A100 GPU-hrs' },
      { key: 'h100', label: 'H100 GPU-hrs' },
      { key: 'costa', label: 'Cost @A100' },
      { key: 'costh', label: 'Cost @H100' },
      { key: 'savings', label: 'Savings vs A100' },
    ],
    data.trainingCosts.map((m) => {
      const savingsPct = ((m.costA100CloudLow - m.costH100CloudLow) / m.costA100CloudLow) * 100;
      return {
        model: `<strong>${m.modelSize}</strong>`,
        a100: formatNumber(m.trainingGpuHoursA100),
        h100: formatNumber(m.trainingGpuHoursH100),
        costa: `$${formatNumber(m.costA100CloudLow)}`,
        costh: `$${formatNumber(m.costH100CloudLow)}`,
        savings: `${savingsPct.toFixed(1)}%`,
      };
    })
  );
}

function renderInferenceSection(data) {
  const modelOptions = data.inferencePerformance.map((m) => ({ value: m.model, label: m.model }));
  const gpuOptions = [
    { value: 'A100', label: 'A100 (FP16)' },
    { value: 'H100_FP16', label: 'H100 (FP16)' },
    { value: 'H100_FP8', label: 'H100 (FP8)' },
    { value: 'B200_FP8', label: 'B200 (FP8)' },
    { value: 'B200_FP4', label: 'B200 (FP4)' },
  ];

  document.getElementById('inference-form').innerHTML = [
    buildField({ label: 'Model', id: 'inference-model', type: 'select', options: modelOptions }),
    buildField({ label: 'GPU', id: 'inference-gpu', type: 'select', options: gpuOptions }),
    buildField({ label: 'Monthly tokens (millions)', id: 'inference-tokens', value: 1000, min: 1 }),
    buildField({ label: 'GPU hourly cost ($)', id: 'inference-cost', value: 2.4, step: 0.01 }),
  ].join('');

  const render = () => {
    const model = document.getElementById('inference-model').value;
    const gpu = document.getElementById('inference-gpu').value;
    const tokensM = parseFloat(document.getElementById('inference-tokens').value);
    const gpuCost = parseFloat(document.getElementById('inference-cost').value);

    const row = data.inferencePerformance.find((m) => m.model === model);
    const tps =
      gpu === 'A100'
        ? row.tokensPerSecondA100
        : gpu === 'H100_FP16'
        ? row.tokensPerSecondH100Fp16
        : gpu === 'H100_FP8'
        ? row.tokensPerSecondH100Fp8
        : gpu === 'B200_FP8'
        ? row.tokensPerSecondB200Fp8
        : row.tokensPerSecondB200Fp4;

    const tokens = tokensM * 1_000_000;
    const hours = tokens / tps / 3600;
    const cost = hours * gpuCost;
    const maxTokensM = (tps * 3600 * 24 * 30) / 1_000_000;
    const utilization = (tokensM / maxTokensM) * 100;

    document.getElementById('inference-result').innerHTML = `
      <h3>Inference economics</h3>
      <div class="result-grid">
        <div class="result-item"><strong>Throughput</strong><div>${formatNumber(tps)} tok/s</div></div>
        <div class="result-item"><strong>GPU-hours</strong><div>${formatNumber(hours, { maximumFractionDigits: 0 })}</div></div>
        <div class="result-item"><strong>Monthly cost</strong><div>$${formatNumber(cost, { maximumFractionDigits: 0 })}</div></div>
        <div class="result-item"><strong>Cost / 1M tokens</strong><div>$${(cost / tokensM).toFixed(2)}</div></div>
        <div class="result-item"><strong>Utilization</strong><div>${utilization.toFixed(1)}% of 1 GPU</div></div>
      </div>
    `;
  };

  document.getElementById('run-inference').onclick = render;
  render();

  buildTable(
    'inference-table',
    [
      { key: 'model', label: 'Model' },
      { key: 'mem', label: 'Memory (GB)' },
      { key: 'a100', label: 'A100 tok/s' },
      { key: 'h100', label: 'H100 FP16' },
      { key: 'h100fp8', label: 'H100 FP8' },
      { key: 'b200', label: 'B200 FP8' },
      { key: 'b200fp4', label: 'B200 FP4' },
    ],
    data.inferencePerformance.map((row) => ({
      model: `<strong>${row.model}</strong>`,
      mem: row.memoryRequiredGb,
      a100: row.tokensPerSecondA100,
      h100: row.tokensPerSecondH100Fp16,
      h100fp8: row.tokensPerSecondH100Fp8,
      b200: row.tokensPerSecondB200Fp8,
      b200fp4: row.tokensPerSecondB200Fp4,
    }))
  );
}

function renderTcoSection(data) {
  const gpuOptions = data.gpuSpecifications.map((gpu) => ({ value: gpu.architecture, label: gpu.architecture }));
  document.getElementById('tco-form').innerHTML = [
    buildField({ label: 'GPU model', id: 'tco-gpu', type: 'select', options: gpuOptions }),
    buildField({ label: 'GPU count', id: 'tco-count', value: 64, min: 1 }),
    buildField({ label: 'GPU purchase price ($)', id: 'tco-price', value: 30000, step: 100 }),
    buildField({ label: 'Power cost ($/kWh)', id: 'tco-power', value: 0.09, step: 0.001 }),
    buildField({ label: 'PUE', id: 'tco-pue', value: 1.25, step: 0.05 }),
    buildField({ label: 'Utilization (%)', id: 'tco-util', value: 85, step: 1, min: 0, max: 100 }),
    buildField({ label: 'Contract (years)', id: 'tco-years', value: 4, min: 1 }),
    buildField({ label: 'Target IRR (%)', id: 'tco-irr', value: 25, min: 0, max: 100 }),
  ].join('');

  const render = () => {
    const gpuName = document.getElementById('tco-gpu').value;
    const gpuCount = parseFloat(document.getElementById('tco-count').value);
    const gpuPrice = parseFloat(document.getElementById('tco-price').value);
    const powerCost = parseFloat(document.getElementById('tco-power').value);
    const pue = parseFloat(document.getElementById('tco-pue').value);
    const util = parseFloat(document.getElementById('tco-util').value) / 100;
    const years = parseFloat(document.getElementById('tco-years').value);
    const irr = parseFloat(document.getElementById('tco-irr').value) / 100;

    const gpu = data.gpuSpecifications.find((g) => g.architecture === gpuName);
    const overhead = 575;
    const totalPowerKw = ((gpu?.tdpWatts || 700) + overhead) * gpuCount / 1000;

    const gpuCapex = gpuCount * gpuPrice;
    const network = gpuCount * 2000;
    const totalCapex = gpuCapex + network;
    const annualHours = 8760;
    const utilisedHours = annualHours * util;
    const annualPower = totalPowerKw * pue * powerCost * annualHours;
    const maintenance = totalCapex * 0.05;
    const staff = (gpuCount / 100) * 150000;
    const annualOpex = annualPower + maintenance + staff;

    const totalCosts = totalCapex + annualOpex * years;
    const requiredRevenue = totalCosts * (1 + irr);
    const totalGpuHours = gpuCount * utilisedHours * years;
    const requiredRate = requiredRevenue / totalGpuHours;

    const marketRate = gpu?.cloudRentalLow || 2.4;
    const competitiveness = (marketRate / requiredRate) * 100;

    document.getElementById('tco-result').innerHTML = `
      <h3>TCO & target IRR</h3>
      <div class="result-grid">
        <div class="result-item"><strong>Total CapEx</strong><div>$${formatNumber(totalCapex, { maximumFractionDigits: 0 })}</div></div>
        <div class="result-item"><strong>Annual OpEx</strong><div>$${formatNumber(annualOpex, { maximumFractionDigits: 0 })}</div></div>
        <div class="result-item"><strong>Required rate</strong><div>$${requiredRate.toFixed(2)}/GPU-hr</div></div>
        <div class="result-item"><strong>Market ref</strong><div>$${marketRate.toFixed(2)}/GPU-hr</div></div>
        <div class="result-item"><strong>Power draw</strong><div>${totalPowerKw.toFixed(1)} kW (PUE ${pue})</div></div>
        <div class="result-item"><strong>Rate vs market</strong><div>${competitiveness.toFixed(1)}% ${competitiveness > 100 ? '✓' : '✗'}</div></div>
      </div>
    `;
  };

  document.getElementById('run-tco').onclick = render;
  render();
}

function renderMarketSection(data) {
  buildTable(
    'market-table',
    [
      { key: 'year', label: 'Year' },
      { key: 'rental', label: 'GPU rental ($B)' },
      { key: 'cloud', label: 'Cloud AI ($B)' },
      { key: 'infra', label: 'AI infra ($B)' },
    ],
    data.marketForecast.map((m) => ({
      year: `<strong>${m.year}</strong>`,
      rental: `$${m.gpuRentalMarketB.toFixed(2)}`,
      cloud: `$${m.cloudAiMarketB.toFixed(2)}`,
      infra: `$${m.aiInfrastructureMarketB.toFixed(2)}`,
    }))
  );

  if (charts.market) charts.market.destroy();
  charts.market = new Chart(document.getElementById('market-chart').getContext('2d'), {
    type: 'line',
    data: {
      labels: data.marketForecast.map((m) => m.year),
      datasets: [
        { label: 'GPU rental', data: data.marketForecast.map((m) => m.gpuRentalMarketB), borderColor: 'rgba(124,93,255,1)', fill: true, backgroundColor: 'rgba(124,93,255,0.12)', tension: 0.35 },
        { label: 'Cloud AI', data: data.marketForecast.map((m) => m.cloudAiMarketB), borderColor: 'rgba(39,211,162,1)', fill: true, backgroundColor: 'rgba(39,211,162,0.12)', tension: 0.35 },
        { label: 'AI infra', data: data.marketForecast.map((m) => m.aiInfrastructureMarketB), borderColor: 'rgba(255,255,255,0.8)', fill: true, backgroundColor: 'rgba(255,255,255,0.08)', tension: 0.35 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true } } },
  });
}

function exportTableAsCsv(tableId, filename) {
  const rows = Array.from(document.querySelectorAll(`#${tableId} tr`)).map((row) =>
    Array.from(row.querySelectorAll('th,td'))
      .map((cell) => cell.textContent.replace(/"/g, '""'))
      .map((text) => `"${text}"`)
      .join(',')
  );
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

async function renderAll() {
  dataCache = await loadData();
  renderStats(dataCache);
  renderGpuSection(dataCache);
  renderCloudSection(dataCache);
  renderTrainingSection(dataCache);
  renderInferenceSection(dataCache);
  renderTcoSection(dataCache);
  renderMarketSection(dataCache);
}

function scheduleRefresh() {
  setInterval(() => {
    renderAll().catch((err) => console.error(err));
  }, refreshIntervalMs);
}

function setupRefreshButton() {
  document.getElementById('refresh-button').onclick = () => renderAll().catch((err) => alert(err.message));
}

document.addEventListener('DOMContentLoaded', () => {
  setupRefreshButton();
  renderAll().catch((err) => {
    document.getElementById('data-hint').textContent = err.message;
  });
  scheduleRefresh();
});
