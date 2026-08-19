# Scripts

## convert-tailwind-classes.sh

Tailwind CSS 클래스를 프로젝트 컨벤션에 맞게 자동 변환하는 스크립트입니다.

### 사용법

```bash
# 파일권한부여
chmod +x ./scripts/convert-tailwind-classes.sh

# 미리보기 (실제 변경 없음)
./scripts/convert-tailwind-classes.sh --dry-run

# 전체 변환 실행
./scripts/convert-tailwind-classes.sh

# Font만 변환
./scripts/convert-tailwind-classes.sh --font-only

# Spacing만 변환
./scripts/convert-tailwind-classes.sh --spacing-only

# 도움말
./scripts/convert-tailwind-classes.sh --help
```

### 변환 규칙

#### 1. Font Weight (semantic → numeric)

가독성을 위해 font-weight는 숫자 형태로 통일합니다.

| Before            | After        |
| ----------------- | ------------ |
| `font-thin`       | `font-[100]` |
| `font-extralight` | `font-[200]` |
| `font-light`      | `font-[300]` |
| `font-normal`     | `font-[400]` |
| `font-medium`     | `font-[500]` |
| `font-semibold`   | `font-[600]` |
| `font-bold`       | `font-[700]` |
| `font-extrabold`  | `font-[800]` |
| `font-black`      | `font-[900]` |

#### 2. Spacing (arbitrary → semantic)

arbitrary value를 Tailwind 표준 토큰으로 변환합니다. (w-96 = 384px까지 지원)

| arbitrary    | semantic | rem     |
| ------------ | -------- | ------- |
| `*-[1px]`    | `*-px`   | 1px     |
| `*-[2px]`    | `*-0.5`  | 0.125   |
| `*-[4px]`    | `*-1`    | 0.25    |
| `*-[6px]`    | `*-1.5`  | 0.375   |
| `*-[8px]`    | `*-2`    | 0.5     |
| `*-[10px]`   | `*-2.5`  | 0.625   |
| `*-[12px]`   | `*-3`    | 0.75    |
| `*-[14px]`   | `*-3.5`  | 0.875   |
| `*-[16px]`   | `*-4`    | 1       |
| `*-[20px]`   | `*-5`    | 1.25    |
| `*-[24px]`   | `*-6`    | 1.5     |
| `*-[28px]`   | `*-7`    | 1.75    |
| `*-[32px]`   | `*-8`    | 2       |
| `*-[36px]`   | `*-9`    | 2.25    |
| `*-[40px]`   | `*-10`   | 2.5     |
| `*-[44px]`   | `*-11`   | 2.75    |
| `*-[48px]`   | `*-12`   | 3       |
| `*-[56px]`   | `*-14`   | 3.5     |
| `*-[64px]`   | `*-16`   | 4       |
| `*-[72px]`   | `*-18`   | 4.5     |
| `*-[80px]`   | `*-20`   | 5       |
| `*-[88px]`   | `*-22`   | 5.5     |
| `*-[96px]`   | `*-24`   | 6       |
| `*-[104px]`  | `*-26`   | 6.5     |
| `*-[112px]`  | `*-28`   | 7       |
| `*-[128px]`  | `*-32`   | 8       |
| `*-[144px]`  | `*-36`   | 9       |
| `*-[160px]`  | `*-40`   | 10      |
| `*-[176px]`  | `*-44`   | 11      |
| `*-[192px]`  | `*-48`   | 12      |
| `*-[208px]`  | `*-52`   | 13      |
| `*-[224px]`  | `*-56`   | 14      |
| `*-[240px]`  | `*-60`   | 15      |
| `*-[256px]`  | `*-64`   | 16      |
| `*-[288px]`  | `*-72`   | 18      |
| `*-[320px]`  | `*-80`   | 20      |
| `*-[384px]`  | `*-96`   | 24      |

**적용 대상 prefix:**

- padding: `p`, `px`, `py`, `pt`, `pr`, `pb`, `pl`
- margin: `m`, `mx`, `my`, `mt`, `mr`, `mb`, `ml`
- gap: `gap`
- space: `space-x`, `space-y`
- size: `w`, `h`, `min-w`, `min-h`, `max-w`, `max-h`
- position: `top`, `right`, `bottom`, `left`, `inset`, `inset-x`, `inset-y`

#### 3. Border Radius (arbitrary → semantic)

| arbitrary        | semantic      | rem   |
| ---------------- | ------------- | ----- |
| `rounded-[2px]`  | `rounded-sm`  | 0.125 |
| `rounded-[4px]`  | `rounded`     | 0.25  |
| `rounded-[6px]`  | `rounded-md`  | 0.375 |
| `rounded-[8px]`  | `rounded-lg`  | 0.5   |
| `rounded-[12px]` | `rounded-xl`  | 0.75  |
| `rounded-[16px]` | `rounded-2xl` | 1     |
| `rounded-[24px]` | `rounded-3xl` | 1.5   |

**적용 대상 prefix:**

- `rounded`, `rounded-t`, `rounded-r`, `rounded-b`, `rounded-l`
- `rounded-tl`, `rounded-tr`, `rounded-br`, `rounded-bl`
- `rounded-s`, `rounded-e`, `rounded-ss`, `rounded-se`, `rounded-es`, `rounded-ee`

#### 4. Text Size (arbitrary → semantic)

| arbitrary      | semantic    | rem   |
| -------------- | ----------- | ----- |
| `text-[12px]`  | `text-xs`   | 0.75  |
| `text-[14px]`  | `text-sm`   | 0.875 |
| `text-[16px]`  | `text-base` | 1     |
| `text-[18px]`  | `text-lg`   | 1.125 |
| `text-[20px]`  | `text-xl`   | 1.25  |
| `text-[24px]`  | `text-2xl`  | 1.5   |
| `text-[30px]`  | `text-3xl`  | 1.875 |
| `text-[36px]`  | `text-4xl`  | 2.25  |
| `text-[48px]`  | `text-5xl`  | 3     |
| `text-[60px]`  | `text-6xl`  | 3.75  |
| `text-[72px]`  | `text-7xl`  | 4.5   |
| `text-[96px]`  | `text-8xl`  | 6     |
| `text-[128px]` | `text-9xl`  | 8     |

#### 5. 띄어쓰기 누락 수정

반응형 prefix 앞에 띄어쓰기가 누락된 경우 자동 수정합니다.

```tsx
// Before
className="space-y-2sm:w-full"
className="p-[8px]sm:flex"

// After
className="space-y-2 sm:w-full"
className="p-[8px] sm:flex"
```

### 변환 제외

Tailwind 표준 토큰에 없는 값은 변환하지 않고 그대로 유지합니다.

```tsx
// 변환되지 않음 (표준 토큰 없음)
className="px-[60px] pt-[50px] w-[130px] text-[11px] rounded-[10px]"

// 변환됨
className="pb-[16px] gap-[24px] rounded-[12px] text-[14px]"
// → className="pb-4 gap-6 rounded-xl text-sm"
```

### 권장 워크플로우

1. 자유롭게 코딩 (arbitrary value 사용 가능)
2. 작업 완료 후 `--dry-run`으로 변환 대상 확인
3. 스크립트 실행하여 일괄 변환
4. lint 및 빌드 확인

```bash
# 1. 변환 대상 확인
./scripts/convert-tailwind-classes.sh --dry-run

# 2. 변환 실행
./scripts/convert-tailwind-classes.sh

# 3. lint 확인
npm run lint
```
