import * as fs from 'fs';
import * as path from 'path';

const srcDir = path.join(__dirname, '..', '..', 'src');

const findEnvMocks = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) {
      return [];
    }
    const child = path.join(dir, entry.name);
    if (entry.name === '__mocks__') {
      return fs.existsSync(path.join(child, 'env.ts')) ? [child] : [];
    }
    return findEnvMocks(child);
  });

for (const mockDir of findEnvMocks(srcDir)) {
  const realModule = path.join(path.dirname(mockDir), 'env');
  const mockModule = path.join(mockDir, 'env');
  jest.doMock(realModule, () => jest.requireActual(mockModule));
}
