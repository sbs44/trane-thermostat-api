/** @type {import('npm-check-updates').RcOptions } */
module.exports = {
  target: (name, semver) => {
    if (
      name === '@types/node' ||
      name === '@types/jest' ||
      name === 'jest'
    )
      return 'minor';
    return 'latest';
  },
};
