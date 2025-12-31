const fs = require('fs');
const path = require('path');

function getLicenses(pkgPath) {
  const pkg = JSON.parse(fs.readFileSync(path.join(pkgPath, 'package.json'), 'utf8'));
  const deps = pkg.dependencies || {};
  const devDeps = pkg.devDependencies || {};
  
  const allDeps = { ...deps, ...devDeps };
  const licenses = {};
  
  Object.keys(allDeps).forEach(k => {
    try {
      const depPkg = JSON.parse(fs.readFileSync(path.join(pkgPath, 'node_modules', k, 'package.json'), 'utf8'));
      licenses[k] = depPkg.license || 'UNKNOWN';
    } catch(e) {
      licenses[k] = 'NOT_FOUND';
    }
  });
  
  return licenses;
}

console.log('===== BACKEND DEPENDENCIES AND LICENSES =====\n');
const backendLicenses = getLicenses('./backend');
Object.keys(backendLicenses).sort().forEach(k => {
  console.log(`${k}: ${backendLicenses[k]}`);
});

console.log('\n===== FRONTEND DEPENDENCIES AND LICENSES =====\n');
const frontendLicenses = getLicenses('./frontend');
Object.keys(frontendLicenses).sort().forEach(k => {
  console.log(`${k}: ${frontendLicenses[k]}`);
});
