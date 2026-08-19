# Scripts

## convert-relative-imports.sh

상대 경로(`../`, `../../` 등)를 절대 경로(`@/`)로 자동 변환하는 스크립트입니다.

### 사용법

```bash
# 파일권한부여
chmod +x ./scripts/convert-relative-imports.sh

# 미리보기 (실제 변경 없음)
./scripts/convert-relative-imports.sh --dry-run

# 전체 변환 실행
./scripts/convert-relative-imports.sh

# 특정 파일만 변환
./scripts/convert-relative-imports.sh --file src/components/Example.tsx

# 도움말
./scripts/convert-relative-imports.sh --help
```

### 변환 규칙

현재 파일 위치를 기준으로 상대 경로를 계산하여 `@/` 절대 경로로 변환합니다.

#### 변환 예시

**src/components/language/LanguageInitializer.tsx**

```tsx
// Before
import { LockGuard } from '../study/list/LockGuard';

// After
import { LockGuard } from '@/components/study/list/LockGuard';
```

**src/hooks/lock/use-lock-refresh.ts**

```tsx
// Before
import { useLockMutation } from '../mutations/use-lock-mutation';

// After
import { useLockMutation } from '@/hooks/mutations/use-lock-mutation';
```

**src/components/auth/AuthProvider.tsx**

```tsx
// Before
import { useAuth } from '../../hooks/useAuth';
import { API } from '../../services/api';

// After
import { useAuth } from '@/hooks/useAuth';
import { API } from '@/services/api';
```

### 경로 별칭 설정

이 스크립트는 `tsconfig.json`에 설정된 경로 별칭을 기반으로 합니다.

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 변환 대상

- `../` 로 시작하는 모든 import 경로
- `.ts`, `.tsx` 파일만 대상

### 변환 제외

다음은 변환하지 않습니다:

```tsx
// 같은 디렉토리 상대 경로 (./로 시작)
import { Button } from './Button';

// 외부 패키지
import React from 'react';

// 이미 절대 경로인 경우
import { utils } from '@/utils';
```

### 권장 워크플로우

1. `--dry-run`으로 변환 대상 확인
2. 스크립트 실행하여 일괄 변환
3. TypeScript 컴파일 확인
4. lint 및 빌드 확인

```bash
# 1. 변환 대상 확인
./scripts/convert-relative-imports.sh --dry-run

# 2. 변환 실행
./scripts/convert-relative-imports.sh

# 3. TypeScript 확인
npx tsc --noEmit

# 4. lint 확인
npm run lint
```

### 주의사항

- 변환 전 반드시 `--dry-run`으로 미리보기를 권장합니다
- Git에 변경사항이 없는 상태에서 실행하면 롤백이 쉽습니다
- 변환 후 IDE에서 import 경로가 정상인지 확인하세요
