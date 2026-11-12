const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const projectRoot = process.cwd();
const packageJson = JSON.parse(
  readFileSync(path.join(projectRoot, 'package.json'), 'utf8'),
);

function readProjectFile(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('project scaffold acceptance criteria', () => {
  test('npm test runs Jest and Supertest is available for HTTP tests', () => {
    expect(packageJson.scripts.test).toMatch(/^jest(?:\s|$)/);
    expect(packageJson.devDependencies.jest).toEqual(expect.any(String));
    expect(packageJson.devDependencies.supertest).toEqual(expect.any(String));
  });

  test('pull request CI runs ESLint and the test command', () => {
    const workflow = readProjectFile('.github/workflows/ci.yml');

    expect(workflow).toMatch(/^\s*pull_request\s*:/m);
    expect(workflow).toMatch(/run:\s*npm run lint\b/);
    expect(workflow).toMatch(/run:\s*npm test\b/);
  });

  test('README documents Node.js setup and the start, test, and lint commands', () => {
    const readme = readProjectFile('README.md');

    expect(readme).toMatch(/Node\.js\s+20/i);
    expect(readme).toMatch(/npm ci/);
    expect(readme).toMatch(/npm start/);
    expect(readme).toMatch(/npm test/);
    expect(readme).toMatch(/npm run lint/);
    expect(readme).toContain('[CONTRIBUTING.md](CONTRIBUTING.md)');
    expect(readme).toContain('[changelog](CHANGELOG.md)');
    expect(readme).toContain('[docs/agent-log.md](docs/agent-log.md)');
  });

  test('project uses Express or Fastify and configures ESLint', () => {
    const dependencies = packageJson.dependencies || {};
    const eslintConfigFiles = [
      'eslint.config.js',
      'eslint.config.cjs',
      'eslint.config.mjs',
      '.eslintrc',
      '.eslintrc.js',
      '.eslintrc.cjs',
      '.eslintrc.json',
    ];

    expect(['express', 'fastify'].some((framework) => dependencies[framework])).toBe(true);
    expect(packageJson.scripts.lint).toMatch(/\beslint\b/);
    expect(packageJson.devDependencies.eslint).toEqual(expect.any(String));
    expect(eslintConfigFiles.some((file) => existsSync(path.join(projectRoot, file)))).toBe(true);
  });
});
