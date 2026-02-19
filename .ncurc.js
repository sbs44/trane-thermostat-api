/** @type {import('npm-check-updates').RcOptions } */
module.exports = {
  target: (name, semver) => {
    if (
      name === '@types/node' ||
      name === '@types/jest' ||
      name === 'jest' ||
      name === 'eslint' ||
      name === '@eslint/js'
    )
      return 'minor';
    return 'latest';
  },
};
