// eslint-disable-next-line max-classes-per-file
const core = require('@actions/core');
const { run } = require('./app');

run()
  .catch((error) => {
    core.setFailed(error.message);
  });
