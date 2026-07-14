export function parseCambridgePage(html) {
  let result = { ukIpa: '', usIpa: '', ukAudio: '', usAudio: '', level: '', senses: [], allLevels: [], usHeadword: '', ukHeadword: '' };
  
  const ukRegex = /<span\s+class="uk dpron-i\s*"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/g;
  const ukMatch = ukRegex.exec(html);
  if (ukMatch) {
    const ukBlock = ukMatch[1];
    const audioMatch = /<source\s+type="audio\/mpeg"\s+src="([^"]+)"/i.exec(ukBlock);
    if (audioMatch) {
      result.ukAudio = 'https://dictionary.cambridge.org' + audioMatch[1];
    }
    const ipaRegex = /<span\s+class="ipa dipa[^>]*>([\s\S]*?)<\/span>\s*\//i;
    const ipaMatch = ipaRegex.exec(ukBlock);
    if (ipaMatch) {
      result.ukIpa = '/' + ipaMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() + '/';
    }
  }

  const usRegex = /<span\s+class="us dpron-i\s*"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/g;
  const usMatch = usRegex.exec(html);
  if (usMatch) {
    const usBlock = usMatch[1];
    const audioMatch = /<source\s+type="audio\/mpeg"\s+src="([^"]+)"/i.exec(usBlock);
    if (audioMatch) {
      result.usAudio = 'https://dictionary.cambridge.org' + audioMatch[1];
    }
    const ipaRegex = /<span\s+class="ipa dipa[^>]*>([\s\S]*?)<\/span>\s*\//i;
    const ipaMatch = ipaRegex.exec(usBlock);
    if (ipaMatch) {
      result.usIpa = '/' + ipaMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() + '/';
    }
  }

  // Extract all definition-level pairs from sense blocks (ddef_h)
  const senseRegex = /<div\s+class="ddef_h">([\s\S]*?)<\/div>\s*<\/div>/g;
  let sm;
  const levelsSet = new Set();
  while ((sm = senseRegex.exec(html)) !== null) {
    const block = sm[1];
    let senseLevel = '';
    const lvlMatch = /<span\s+class="[^"]*(?:epp-xref|cefr)[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(block);
    if (lvlMatch) {
      const lt = lvlMatch[1].replace(/<[^>]*>/g, '').trim().toUpperCase();
      if (/^[A-C][1-2]$/.test(lt)) { senseLevel = lt; levelsSet.add(lt); }
    }
    const defMatch = /<div\s+class="def ddef_d[^>]*>([\s\S]*?)<\/div>/i.exec(block);
    if (defMatch) {
      let defText = defMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      if (defText.endsWith(':')) defText = defText.slice(0, -1).trim();
      if (defText) result.senses.push({ definition: defText, level: senseLevel });
    }
  }

  result.allLevels = [...levelsSet];
  result.level = result.senses.find(s => s.level)?.level || result.allLevels[0] || '';

  // Extract US/UK variant headwords from Cambridge page
  // Cambridge uses 'var dvar' class for variant spellings (e.g., "licence" page shows "license" as US variant)
  const variantRegex = /<span\s+class="[^"]*(?:var\s+dvar|v\s+dv)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let varMatch;
  while ((varMatch = variantRegex.exec(html)) !== null) {
    const varText = varMatch[1].replace(/<[^>]*>/g, '').trim().toLowerCase();
    if (varText.includes('us')) {
      // Extract the US variant word — look for the word itself near this context
      const usWordRegex = /<span\s+class="[^"]*v-g[^"]*"[^>]*>[\s\S]*?<span\s+class="[^"]*v[^"]*"[^>]*>([^<]+)<\/span>/i;
      const usWordMatch = usWordRegex.exec(html.slice(Math.max(0, varMatch.index - 200), varMatch.index + 300));
      if (usWordMatch) {
        result.usHeadword = usWordMatch[1].trim().toLowerCase();
      }
    }
  }

  // Simpler approach: look for "US spelling" or variant block in the page
  const headwordRegex = /<span\s+class="[^"]*hw\s+dhw[^"]*"[^>]*>([^<]+)<\/span>/gi;
  const headwords = [];
  let hwMatch;
  while ((hwMatch = headwordRegex.exec(html)) !== null) {
    const hw = hwMatch[1].trim().toLowerCase();
    if (!headwords.includes(hw)) headwords.push(hw);
  }
  // If multiple distinct headwords found, first is typically UK, variant could be US
  if (headwords.length >= 1 && !result.ukHeadword) {
    result.ukHeadword = headwords[0];
  }

  return result;
}

export function parseOxfordPage(html) {
  let result = { ukIpa: '', usIpa: '', ukAudio: '', usAudio: '', level: '' };
  
  const ukRegex = /class="[^"]*pron-uk[^"]*"[^>]*data-src-mp3="([^"]+)"[\s\S]*?<span\s+class="phon">([^<]+)<\/span>/i;
  const ukMatch = ukRegex.exec(html);
  if (ukMatch) {
    result.ukAudio = ukMatch[1];
    result.ukIpa = ukMatch[2].trim();
  }

  const usRegex = /class="[^"]*pron-us[^"]*"[^>]*data-src-mp3="([^"]+)"[\s\S]*?<span\s+class="phon">([^<]+)<\/span>/i;
  const usMatch = usRegex.exec(html);
  if (usMatch) {
    result.usAudio = usMatch[1];
    result.usIpa = usMatch[2].trim();
  }

  const cefrRegex = /<span\s+class="cefr"[^>]*>([\s\S]*?)<\/span>/gi;
  let m;
  while ((m = cefrRegex.exec(html)) !== null) {
    const txt = m[1].replace(/<[^>]*>/g, '').trim().toUpperCase();
    if (/^[A-C][1-2]$/.test(txt)) {
      result.level = txt;
      break;
    }
  }
  if (!result.level) {
    const oxRegex = /data-ox(?:3000|5000)="([a-c][1-2])"/i;
    const oxMatch = oxRegex.exec(html);
    if (oxMatch) {
      result.level = oxMatch[1].toUpperCase();
    }
  }
  return result;
}
