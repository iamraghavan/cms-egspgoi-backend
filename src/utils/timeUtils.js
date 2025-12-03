const getISTTimestamp = () => {
  const date = new Date();
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).replace(',', ' -');
};

const parseISTTimestamp = (dateString) => {
  // Format: DD/MM/YYYY - HH:MM:SS AM/PM
  if (!dateString) return new Date(0);
  // Handle ISO strings just in case
  if (dateString.includes('T') && dateString.endsWith('Z')) return new Date(dateString);

  const [datePart, timePart] = dateString.split(' - ');
  if (!datePart || !timePart) return new Date(dateString); // Fallback

  const [day, month, year] = datePart.split('/');
  let [time, period] = timePart.split(' ');
  let [hours, minutes, seconds] = time.split(':');

  hours = parseInt(hours);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return new Date(year, month - 1, day, hours, minutes, seconds);
};

module.exports = { getISTTimestamp, parseISTTimestamp };
