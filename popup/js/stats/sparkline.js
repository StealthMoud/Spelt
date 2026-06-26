import { showStatsTooltip, hideStatsTooltip } from './tooltip.js';

export function drawSparkline(containerId, dataPoints, width = 300, height = 60, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  
  if (dataPoints.length === 0 || Math.max(...dataPoints, 0) === 0) {
    container.innerHTML = '<div class="leeches-empty-text">No activity data in this period.</div>';
    return;
  }
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.style.overflow = 'visible';
  
  const maxVal = Math.max(...dataPoints, 1);
  const minVal = 0;
  const range = maxVal - minVal;
  const paddingLeft = 10, paddingRight = 10, paddingTop = 8, paddingBottom = 8;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const points = dataPoints.map((val, idx) => {
    const x = paddingLeft + (idx / Math.max(dataPoints.length - 1, 1)) * chartWidth;
    const y = paddingTop + chartHeight - ((val - minVal) / range) * chartHeight;
    return { x, y, val };
  });
  
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) pathD += ` L ${points[i].x} ${points[i].y}`;
  
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', options.strokeColor || 'var(--primary)');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  
  let areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;
  const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  area.setAttribute('d', areaD);
  
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  const gradId = `spark-grad-${Math.random().toString(36).substr(2, 9)}`;
  gradient.setAttribute('id', gradId);
  gradient.setAttribute('x1', '0%'); gradient.setAttribute('y1', '0%');
  gradient.setAttribute('x2', '0%'); gradient.setAttribute('y2', '100%');
  
  const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop1.setAttribute('offset', '0%');
  stop1.setAttribute('stop-color', options.strokeColor || 'var(--primary)');
  stop1.setAttribute('stop-opacity', '0.2');
  
  const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
  stop2.setAttribute('offset', '100%');
  stop2.setAttribute('stop-color', options.strokeColor || 'var(--primary)');
  stop2.setAttribute('stop-opacity', '0');
  
  gradient.appendChild(stop1); gradient.appendChild(stop2);
  defs.appendChild(gradient); svg.appendChild(defs);
  
  area.setAttribute('fill', `url(#${gradId})`);
  svg.appendChild(area); svg.appendChild(path);
  
  points.forEach((pt, idx) => {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pt.x.toString()); circle.setAttribute('cy', pt.y.toString());
    circle.setAttribute('r', '2.5'); circle.setAttribute('fill', options.dotColor || 'var(--primary-light)');
    circle.setAttribute('stroke', 'var(--bg-dark)'); circle.setAttribute('stroke-width', '1');
    circle.style.cursor = 'pointer'; circle.style.transition = 'all var(--transition-fast) ease';
    
    const label = options.labels ? options.labels[idx] : pt.val.toString();
    const tooltipText = `<strong>${label}</strong><br/>${pt.val}${options.unit || ''}`;
    
    circle.addEventListener('mouseenter', (e) => {
      circle.setAttribute('r', '4.5'); showStatsTooltip(e.clientX, e.clientY, tooltipText);
    });
    circle.addEventListener('mouseleave', () => {
      circle.setAttribute('r', '2.5'); hideStatsTooltip();
    });
    svg.appendChild(circle);
  });
  
  container.appendChild(svg);
}
