#!/usr/bin/env bash

# ============================================================
# Tailwind CSS 클래스 변환 스크립트
# ============================================================
# 사용법: ./scripts/convert-tailwind-classes.sh [옵션]
#
# 옵션:
#   --dry-run       실제 변경 없이 변경될 내용만 미리보기
#   --font-only     font-weight 클래스만 변환 (semantic → numeric)
#   --spacing-only  spacing 클래스만 변환 (arbitrary → semantic)
#   --all           모든 변환 규칙 적용 (기본값)
#   --help          도움말 표시
#
# 예시:
#   ./scripts/convert-tailwind-classes.sh --dry-run
#   ./scripts/convert-tailwind-classes.sh --font-only
#   ./scripts/convert-tailwind-classes.sh --spacing-only
#   ./scripts/convert-tailwind-classes.sh --all
# ============================================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 기본 설정
DRY_RUN=false
FONT_ONLY=false
SPACING_ONLY=false
SRC_DIR="src"

# 도움말 출력
show_help() {
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}Tailwind CSS 클래스 변환 스크립트${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  --dry-run       실제 변경 없이 변경될 내용만 미리보기"
    echo "  --font-only     font-weight 클래스만 변환"
    echo "  --spacing-only  spacing 클래스만 변환"
    echo "  --all           모든 변환 규칙 적용 (기본값)"
    echo "  --help          도움말 표시"
    echo ""
    echo -e "${YELLOW}[1] Font Weight 변환 (semantic → numeric)${NC}"
    echo "  font-thin       → font-[100]"
    echo "  font-extralight → font-[200]"
    echo "  font-light      → font-[300]"
    echo "  font-normal     → font-[400]"
    echo "  font-medium     → font-[500]"
    echo "  font-semibold   → font-[600]"
    echo "  font-bold       → font-[700]"
    echo "  font-extrabold  → font-[800]"
    echo "  font-black      → font-[900]"
    echo ""
    echo -e "${YELLOW}[2] Spacing 변환 (arbitrary → semantic)${NC}"
    echo "  *-[1px]  → *-px     *-[24px] → *-6"
    echo "  *-[2px]  → *-0.5    *-[28px] → *-7"
    echo "  *-[4px]  → *-1      *-[32px] → *-8"
    echo "  *-[6px]  → *-1.5    *-[36px] → *-9"
    echo "  *-[8px]  → *-2      *-[40px] → *-10"
    echo "  *-[10px] → *-2.5    *-[44px] → *-11"
    echo "  *-[12px] → *-3      *-[48px] → *-12"
    echo "  *-[14px] → *-3.5    *-[56px] → *-14"
    echo "  *-[16px] → *-4      *-[64px] → *-16"
    echo "  *-[20px] → *-5      *-[80px] → *-20"
    echo ""
    echo "  적용 prefix: gap, p, px, py, pt, pr, pb, pl,"
    echo "              m, mx, my, mt, mr, mb, ml,"
    echo "              space-x, space-y, w, h, min-w, min-h,"
    echo "              max-w, max-h, top, right, bottom, left, inset"
    echo ""
    echo -e "${CYAN}※ Tailwind 표준 토큰에 없는 값(예: 55px, 60px)은 변환하지 않습니다.${NC}"
    echo ""
    echo -e "${YELLOW}[3] Border Radius 변환 (arbitrary → semantic)${NC}"
    echo "  rounded-[2px]  → rounded-sm   (0.125rem)"
    echo "  rounded-[4px]  → rounded      (0.25rem)"
    echo "  rounded-[6px]  → rounded-md   (0.375rem)"
    echo "  rounded-[8px]  → rounded-lg   (0.5rem)"
    echo "  rounded-[12px] → rounded-xl   (0.75rem)"
    echo "  rounded-[16px] → rounded-2xl  (1rem)"
    echo "  rounded-[24px] → rounded-3xl  (1.5rem)"
    echo ""
    echo "  적용 prefix: rounded, rounded-t, rounded-r, rounded-b, rounded-l,"
    echo "              rounded-tl, rounded-tr, rounded-br, rounded-bl"
    echo ""
    echo -e "${YELLOW}[4] Text Size 변환 (arbitrary → semantic)${NC}"
    echo "  text-[12px] → text-xs   (0.75rem)"
    echo "  text-[14px] → text-sm   (0.875rem)"
    echo "  text-[16px] → text-base (1rem)"
    echo "  text-[18px] → text-lg   (1.125rem)"
    echo "  text-[20px] → text-xl   (1.25rem)"
    echo "  text-[24px] → text-2xl  (1.5rem)"
    echo "  text-[30px] → text-3xl  (1.875rem)"
    echo "  text-[36px] → text-4xl  (2.25rem)"
    echo "  text-[48px] → text-5xl  (3rem)"
    echo "  text-[60px] → text-6xl  (3.75rem)"
    echo ""
    echo -e "${YELLOW}[5] 띄어쓰기 누락 수정${NC}"
    echo "  space-y-2sm:w-full   → space-y-2 sm:w-full"
    echo "  p-[8px]sm:w-full     → p-[8px] sm:w-full"
    echo "  (숫자 또는 ] 뒤 반응형 prefix 앞에 띄어쓰기 추가)"
    echo ""
    exit 0
}

# 인자 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --font-only)
            FONT_ONLY=true
            SPACING_ONLY=false
            shift
            ;;
        --spacing-only)
            SPACING_ONLY=true
            FONT_ONLY=false
            shift
            ;;
        --all)
            FONT_ONLY=false
            SPACING_ONLY=false
            shift
            ;;
        --help)
            show_help
            ;;
        *)
            echo -e "${RED}알 수 없는 옵션: $1${NC}"
            echo "도움말을 보려면 --help를 사용하세요."
            exit 1
            ;;
    esac
done

# 프로젝트 루트 확인
if [ ! -d "$SRC_DIR" ]; then
    echo -e "${RED}에러: src 디렉토리를 찾을 수 없습니다.${NC}"
    echo "프로젝트 루트에서 스크립트를 실행해주세요."
    exit 1
fi

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Tailwind CSS 클래스 변환 시작${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY RUN 모드] 실제 파일은 변경되지 않습니다.${NC}"
    echo ""
fi

# 변환 카운터
TOTAL_CHANGES=0

# sed 실행 함수 (OS 호환)
run_sed() {
    local PATTERN="$1"
    local REPLACEMENT="$2"

    if [[ "$OSTYPE" == "darwin"* ]]; then
        find "$SRC_DIR" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s/$PATTERN/$REPLACEMENT/g" {} +
    else
        find "$SRC_DIR" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i "s/$PATTERN/$REPLACEMENT/g" {} +
    fi
}

# Font-weight 변환 (semantic → numeric)
convert_font_weights() {
    echo -e "${GREEN}[Font Weight] semantic → numeric 변환 중...${NC}"

    declare -a FONT_RULES=(
        "font-extralight:font-[200]"
        "font-extrabold:font-[800]"
        "font-semibold:font-[600]"
        "font-normal:font-[400]"
        "font-medium:font-[500]"
        "font-light:font-[300]"
        "font-black:font-[900]"
        "font-bold:font-[700]"
        "font-thin:font-[100]"
    )

    local FOUND_COUNT=0

    for rule in "${FONT_RULES[@]}"; do
        OLD_CLASS="${rule%%:*}"
        NEW_CLASS="${rule##*:}"

        MATCH_COUNT=$(grep -rl "$OLD_CLASS" "$SRC_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')

        if [ "$MATCH_COUNT" -gt 0 ]; then
            echo -e "  ${YELLOW}$OLD_CLASS${NC} → ${GREEN}$NEW_CLASS${NC} (${MATCH_COUNT}개 파일)"

            if [ "$DRY_RUN" = false ]; then
                run_sed "$OLD_CLASS" "$NEW_CLASS"
            fi

            TOTAL_CHANGES=$((TOTAL_CHANGES + MATCH_COUNT))
            FOUND_COUNT=$((FOUND_COUNT + MATCH_COUNT))
        fi
    done

    if [ "$FOUND_COUNT" -eq 0 ]; then
        echo -e "  ${CYAN}변환할 항목 없음${NC}"
    fi

    echo ""
}

# Spacing 변환 (arbitrary → semantic)
convert_spacing() {
    echo -e "${GREEN}[Spacing] arbitrary → semantic 변환 중...${NC}"

    # Tailwind 표준 spacing 매핑 (px:token 형식)
    # 표준에 있는 값만 변환 (w-96 = 384px까지 지원)
    declare -a SPACING_RULES=(
        "1:px"
        "2:0.5"
        "4:1"
        "6:1.5"
        "8:2"
        "10:2.5"
        "12:3"
        "14:3.5"
        "16:4"
        "20:5"
        "24:6"
        "28:7"
        "32:8"
        "36:9"
        "40:10"
        "44:11"
        "48:12"
        "56:14"
        "64:16"
        "72:18"
        "80:20"
        "88:22"
        "96:24"
        "104:26"
        "112:28"
        "128:32"
        "144:36"
        "160:40"
        "176:44"
        "192:48"
        "208:52"
        "224:56"
        "240:60"
        "256:64"
        "288:72"
        "320:80"
        "384:96"
    )

    # 적용할 prefix 목록
    declare -a PREFIXES=(
        "gap"
        "p" "px" "py" "pt" "pr" "pb" "pl"
        "m" "mx" "my" "mt" "mr" "mb" "ml"
        "space-x" "space-y"
        "w" "h" "min-w" "min-h" "max-w" "max-h"
        "top" "right" "bottom" "left"
        "inset" "inset-x" "inset-y"
    )

    local FOUND_COUNT=0

    for PREFIX in "${PREFIXES[@]}"; do
        local HAS_CHANGES=false

        for rule in "${SPACING_RULES[@]}"; do
            PX="${rule%%:*}"
            TOKEN="${rule##*:}"

            # grep으로 파일 수 확인
            MATCH_COUNT=$(grep -rl "${PREFIX}-\[${PX}px\]" "$SRC_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')

            if [ "$MATCH_COUNT" -gt 0 ]; then
                if [ "$HAS_CHANGES" = false ]; then
                    echo -e "  ${CYAN}${PREFIX}-*${NC}"
                    HAS_CHANGES=true
                fi
                echo -e "    ${YELLOW}${PREFIX}-[${PX}px]${NC} → ${GREEN}${PREFIX}-${TOKEN}${NC} (${MATCH_COUNT}개 파일)"

                if [ "$DRY_RUN" = false ]; then
                    SED_SEARCH="${PREFIX}-\[${PX}px\]"
                    SED_REPLACE="${PREFIX}-${TOKEN}"
                    run_sed "$SED_SEARCH" "$SED_REPLACE"
                fi

                TOTAL_CHANGES=$((TOTAL_CHANGES + MATCH_COUNT))
                FOUND_COUNT=$((FOUND_COUNT + MATCH_COUNT))
            fi
        done
    done

    if [ "$FOUND_COUNT" -eq 0 ]; then
        echo -e "  ${CYAN}변환할 항목 없음${NC}"
    fi

    echo ""
}

# Border Radius 변환 (arbitrary → semantic)
convert_rounded() {
    echo -e "${GREEN}[Border Radius] arbitrary → semantic 변환 중...${NC}"

    # Tailwind 표준 border-radius 매핑 (px:token 형식)
    declare -a ROUNDED_RULES=(
        "2:sm"
        "4:"
        "6:md"
        "8:lg"
        "12:xl"
        "16:2xl"
        "24:3xl"
    )

    # 적용할 prefix 목록
    declare -a PREFIXES=(
        "rounded"
        "rounded-t" "rounded-r" "rounded-b" "rounded-l"
        "rounded-tl" "rounded-tr" "rounded-br" "rounded-bl"
        "rounded-s" "rounded-e"
        "rounded-ss" "rounded-se" "rounded-es" "rounded-ee"
    )

    local FOUND_COUNT=0

    for PREFIX in "${PREFIXES[@]}"; do
        local HAS_CHANGES=false

        for rule in "${ROUNDED_RULES[@]}"; do
            PX="${rule%%:*}"
            TOKEN="${rule##*:}"

            # grep으로 파일 수 확인
            MATCH_COUNT=$(grep -rl "${PREFIX}-\[${PX}px\]" "$SRC_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')

            if [ "$MATCH_COUNT" -gt 0 ]; then
                if [ "$HAS_CHANGES" = false ]; then
                    echo -e "  ${CYAN}${PREFIX}-*${NC}"
                    HAS_CHANGES=true
                fi

                # TOKEN이 비어있으면 (4px → rounded) 그냥 prefix만 사용
                if [ -z "$TOKEN" ]; then
                    echo -e "    ${YELLOW}${PREFIX}-[${PX}px]${NC} → ${GREEN}${PREFIX}${NC} (${MATCH_COUNT}개 파일)"
                    SED_REPLACE="${PREFIX}"
                else
                    echo -e "    ${YELLOW}${PREFIX}-[${PX}px]${NC} → ${GREEN}${PREFIX}-${TOKEN}${NC} (${MATCH_COUNT}개 파일)"
                    SED_REPLACE="${PREFIX}-${TOKEN}"
                fi

                if [ "$DRY_RUN" = false ]; then
                    SED_SEARCH="${PREFIX}-\[${PX}px\]"
                    run_sed "$SED_SEARCH" "$SED_REPLACE"
                fi

                TOTAL_CHANGES=$((TOTAL_CHANGES + MATCH_COUNT))
                FOUND_COUNT=$((FOUND_COUNT + MATCH_COUNT))
            fi
        done
    done

    if [ "$FOUND_COUNT" -eq 0 ]; then
        echo -e "  ${CYAN}변환할 항목 없음${NC}"
    fi

    echo ""
}

# Text Size 변환 (arbitrary → semantic)
convert_text_size() {
    echo -e "${GREEN}[Text Size] arbitrary → semantic 변환 중...${NC}"

    # Tailwind 표준 font-size 매핑 (px:token 형식)
    declare -a TEXT_RULES=(
        "12:xs"
        "14:sm"
        "16:base"
        "18:lg"
        "20:xl"
        "24:2xl"
        "30:3xl"
        "36:4xl"
        "48:5xl"
        "60:6xl"
        "72:7xl"
        "96:8xl"
        "128:9xl"
    )

    local FOUND_COUNT=0

    for rule in "${TEXT_RULES[@]}"; do
        PX="${rule%%:*}"
        TOKEN="${rule##*:}"

        # grep으로 파일 수 확인
        MATCH_COUNT=$(grep -rl "text-\[${PX}px\]" "$SRC_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')

        if [ "$MATCH_COUNT" -gt 0 ]; then
            echo -e "  ${YELLOW}text-[${PX}px]${NC} → ${GREEN}text-${TOKEN}${NC} (${MATCH_COUNT}개 파일)"

            if [ "$DRY_RUN" = false ]; then
                SED_SEARCH="text-\[${PX}px\]"
                SED_REPLACE="text-${TOKEN}"
                run_sed "$SED_SEARCH" "$SED_REPLACE"
            fi

            TOTAL_CHANGES=$((TOTAL_CHANGES + MATCH_COUNT))
            FOUND_COUNT=$((FOUND_COUNT + MATCH_COUNT))
        fi
    done

    if [ "$FOUND_COUNT" -eq 0 ]; then
        echo -e "  ${CYAN}변환할 항목 없음${NC}"
    fi

    echo ""
}

# 띄어쓰기 누락 수정 (예: space-y-2sm: → space-y-2 sm:)
fix_missing_spaces() {
    echo -e "${GREEN}[Spacing Fix] 반응형 미디어쿼리 prefix 앞 띄어쓰기 누락 수정 중...${NC}"

    declare -a RESP_PREFIXES=("sm:" "md:" "lg:" "xl:" "print:")

    local FOUND_COUNT=0

    for RESP in "${RESP_PREFIXES[@]}"; do
        # 패턴 1: 숫자 바로 뒤에 반응형 prefix (예: 2sm: → 2 sm:)
        MATCH_COUNT=$(grep -rEl "[0-9]${RESP}" "$SRC_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')

        if [ "$MATCH_COUNT" -gt 0 ]; then
            echo -e "  ${YELLOW}*[0-9]${RESP}${NC} → ${GREEN}*[0-9] ${RESP}${NC} (${MATCH_COUNT}개 파일)"

            if [ "$DRY_RUN" = false ]; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    find "$SRC_DIR" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s/\([0-9]\)\(${RESP}\)/\1 \2/g" {} +
                else
                    find "$SRC_DIR" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i "s/\([0-9]\)\(${RESP}\)/\1 \2/g" {} +
                fi
            fi

            TOTAL_CHANGES=$((TOTAL_CHANGES + MATCH_COUNT))
            FOUND_COUNT=$((FOUND_COUNT + MATCH_COUNT))
        fi

        # 패턴 2: ] 바로 뒤에 반응형 prefix (예: [8px]sm: → [8px] sm:)
        MATCH_COUNT2=$(grep -rEl "\]${RESP}" "$SRC_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null | wc -l | tr -d ' ')

        if [ "$MATCH_COUNT2" -gt 0 ]; then
            echo -e "  ${YELLOW}*]${RESP}${NC} → ${GREEN}*] ${RESP}${NC} (${MATCH_COUNT2}개 파일)"

            if [ "$DRY_RUN" = false ]; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    find "$SRC_DIR" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' "s/\]\(${RESP}\)/] \1/g" {} +
                else
                    find "$SRC_DIR" -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i "s/\]\(${RESP}\)/] \1/g" {} +
                fi
            fi

            TOTAL_CHANGES=$((TOTAL_CHANGES + MATCH_COUNT2))
            FOUND_COUNT=$((FOUND_COUNT + MATCH_COUNT2))
        fi
    done

    if [ "$FOUND_COUNT" -eq 0 ]; then
        echo -e "  ${CYAN}변환할 항목 없음${NC}"
    fi

    echo ""
}

# 메인 실행
if [ "$FONT_ONLY" = true ]; then
    convert_font_weights
elif [ "$SPACING_ONLY" = true ]; then
    convert_spacing
else
    fix_missing_spaces
    convert_font_weights
    convert_spacing
    convert_rounded
    convert_text_size
fi

# 결과 요약
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}변환 완료${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "총 변경된 파일 수: ${GREEN}$TOTAL_CHANGES${NC}개"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY RUN 모드] 실제 변환을 수행하려면 --dry-run 옵션을 제거하세요.${NC}"
    echo ""
    echo "실행 명령어:"
    echo -e "  ${GREEN}./scripts/convert-tailwind-classes.sh${NC}"
fi

echo ""
echo -e "${GREEN}완료!${NC}"
