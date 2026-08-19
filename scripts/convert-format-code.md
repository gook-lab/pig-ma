# Scripts

## convert-format-code.sh

Prettier를 사용하여 프로젝트 코드를 일괄 포매팅하는 스크립트입니다.

### 사용법

```bash
# 파일권한부여
chmod +x ./scripts/convert-format-code.sh

# src 폴더 포매팅 (기본값)
./scripts/convert-format-code.sh

# 포매팅 필요한 파일 확인만 (실제 변경 없음)
./scripts/convert-format-code.sh --check

# git 스테이징된 파일만 포매팅
./scripts/convert-format-code.sh --staged

# 프로젝트 전체 포매팅
./scripts/convert-format-code.sh --all

# 도움말
./scripts/convert-format-code.sh --help
```

### 옵션

| 옵션        | 설명                                      |
| ----------- | ----------------------------------------- |
| `--check`   | 실제 변경 없이 포매팅 필요한 파일만 확인  |
| `--staged`  | 스테이징된 파일만 포매팅 후 자동 re-stage |
| `--src`     | src 폴더만 포매팅 (기본값)                |
| `--all`     | 프로젝트 전체 포매팅                      |
| `--help`    | 도움말 표시                               |

### 대상 파일 확장자

- TypeScript: `.ts`, `.tsx`
- JavaScript: `.js`, `.jsx`
- 기타: `.json`, `.css`, `.scss`, `.html`

> `.md` 파일은 포매팅 대상에서 제외됩니다.

### Prettier 설정

프로젝트 루트의 `.prettierrc` 파일을 참조합니다.

```json
{
  "tabWidth": 2,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 80,
  "arrowParens": "avoid",
  "singleQuote": true,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

**주요 규칙:**

- 들여쓰기: 2칸 스페이스
- 세미콜론: 항상 사용
- 쉼표: trailing comma 항상 사용
- 줄 길이: 80자
- 화살표 함수: 파라미터 1개일 때 괄호 생략
- 따옴표: 작은따옴표 사용
- Tailwind: 클래스 순서 자동 정렬

### 권장 워크플로우

#### 1. 작업 완료 후 일괄 포매팅

```bash
# 1. 변경 필요한 파일 확인
./scripts/convert-format-code.sh --check

# 2. 포매팅 실행
./scripts/convert-format-code.sh

# 3. lint 확인
npm run lint
```

#### 2. 커밋 전 스테이징 파일만 포매팅

```bash
# 1. 파일 스테이징
git add .

# 2. 스테이징된 파일만 포매팅 (자동 re-stage)
./scripts/convert-format-code.sh --staged

# 3. 커밋
git commit -m "feat: 새 기능 추가"
```

### npm 스크립트와의 차이

| 명령어                           | 설명                       |
| -------------------------------- | -------------------------- |
| `npm run format`                 | 프로젝트 전체 포매팅       |
| `npm run format:check`           | 포매팅 검사만              |
| `./scripts/convert-format-code.sh` | src 폴더만 (기본), 옵션 지원 |

스크립트는 더 세밀한 제어가 필요할 때 사용합니다.
