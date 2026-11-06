// Loaded before every test file (see the `test` script): tests make no update-check network
// calls and never write the update-check cache in the real ~/.pi/pidea.
process.env.PIDEA_UPDATE_CHECK ??= '0'
