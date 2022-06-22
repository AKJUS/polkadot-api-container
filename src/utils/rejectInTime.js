const rejectInTime = (seconds) =>
  new Promise((resolve, reject) => setTimeout(reject, seconds * 1000));

module.exports = {
  rejectInTime,
}
