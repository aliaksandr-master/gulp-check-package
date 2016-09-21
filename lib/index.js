'use strict';

const through = require('through2');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const gutil = require('gulp-util');
const chalk = require('chalk');




const findNotStrictDependencies = (depsHash) => {
  if (_.isEmpty(depsHash)) {
    return [];
  }

  const packages = _.map(depsHash, (version, name) => ({ name, version }));

  const notValidPackages = _.filter(packages, (pack) => !/^\d+/.test(pack.version) && !/^git\+/.test(pack.version));

  return _.map(notValidPackages, (pack) => pack.name);
};




const getAbsentPackages = (cwd, deps) => {
  const result = [];

  _.each(deps, (version, packageName) => {
    const packageJsonFile = path.join(cwd, 'node_modules', packageName, 'package.json');

    if (!fs.existsSync(packageJsonFile)) {
      result.push(packageName);
    }
  });

  return result;
};




const getInvalidPackages = (cwd, deps) => {
  const result = [];

  _.each(deps, (version, packageName) => {
    const packageJsonFile = path.join(cwd, 'node_modules', packageName, 'package.json');

    if (!fs.existsSync(packageJsonFile)) {
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, { encoding: 'utf8' }));

    if (packageJson.version !== version.replace(/^[^\d]+/, '')) {
      result.push(`${packageName}(${packageJson.version} != ${version})`);
    }
  });

  return result;
};




module.exports = (options) => {
  options = _.merge({
    absentPackages: true,
    invalidPackages: true,
    checkDuplicateDependencies: true,
    checkStrictDependencies: true,
    checkStrictDevDependencies: true,
    cwd: process.cwd()
  }, options);




  const error = (file, message) => new gutil.PluginError('gulp-plugin-error', {
    name: 'GulpPluginError',
    message: `${chalk.red(message)} in file "/${path.relative(options.cwd, file.path)}"`
  });




  return through.obj((file, encoding, callback) => {
    if (!file.isBuffer()) {
      callback(null, file);
      return;
    }




    let pkg = file.contents.toString('utf8');

    try {
      pkg = JSON.parse(pkg);
    } catch (err) {
      callback(error(file, 'Invalid JSON format!'));
      return;
    }




    if (options.checkStrictDependencies) {
      const notStrictDependencies = findNotStrictDependencies(pkg.dependencies);

      if (notStrictDependencies.length) {
        callback(error(file, `There are NOT STRICT dependencies [${notStrictDependencies.join(', ')}]`));
        return;
      }
    }




    if (options.checkStrictDevDependencies) {
      const notStrictDevDependencies = findNotStrictDependencies(pkg.devDependencies);

      if (notStrictDevDependencies.length) {
        callback(error(file, `There are NOT STRICT devDependencies [${notStrictDevDependencies.join(', ')}]`));
        return;
      }
    }




    if (options.checkDuplicateDependencies) {
      const duplicatePackages = _.intersection(_.keys(pkg.dependencies), _.keys(pkg.devDependencies));

      if (duplicatePackages.length) {
        callback(error(file, `There are DUPLICATED dependencies [${duplicatePackages.join(', ')}]`));
        return;
      }
    }




    if (options.absentPackages) {
      const absentPackages = getAbsentPackages(options.cwd, pkg.dependencies).concat(getAbsentPackages(options.cwd, pkg.devDependencies));

      if (absentPackages.length) {
        callback(error(file, `There are ABSENT dependencies [${absentPackages.join(', ')}]`));
        return;
      }
    }




    if (options.invalidPackages) {
      const invalidPackages = getInvalidPackages(options.cwd, pkg.dependencies).concat(getInvalidPackages(options.cwd, pkg.devDependencies));

      if (invalidPackages.length) {
        callback(error(file, `There are INVALID dependencies [${invalidPackages.join(', ')}]`));
        return;
      }
    }




    callback(null, file);
  });
};
