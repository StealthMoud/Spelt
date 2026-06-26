export let currentStatsTimeframe = '7d';
export let currentLeechesLimit = '10';
export let currentLeechesCustomVal = 15;
export let calCurrentMonth = new Date().getMonth();
export let calCurrentYear = new Date().getFullYear();
export let calStartDate = null;
export let calEndDate = null;

export function setTimeframe(val) { currentStatsTimeframe = val; }
export function setLeechesLimit(val) { currentLeechesLimit = val; }
export function setLeechesCustomVal(val) { currentLeechesCustomVal = val; }
export function setCalMonth(val) { calCurrentMonth = val; }
export function setCalYear(val) { calCurrentYear = val; }
export function setCalStartDate(val) { calStartDate = val; }
export function setCalEndDate(val) { calEndDate = val; }
