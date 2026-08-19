#!/usr/bin/env bash

# ============================================================
# 상대 경로 → 절대 경로(@/) 변환 스크립트
# ============================================================
# 사용법: ./scripts/convert-relative-imports.sh [옵션]
#
# 옵션:
#   --dry-run       실제 변경 없이 변경될 내용만 미리보기
#   --file <path>   특정 파일만 변환
#   --help          도움말 표시
#
# 예시:
#   ./scripts/convert-relative-imports.sh --dry-run
#   ./scripts/convert-relative-imports.sh
#   ./scripts/convert-relative-imports.sh --file src/components/Example.tsx
#
# 변환 예시:
#   (src/components/auth/LanguageInitializer.tsx 파일에서)
#   import { LockGuard } from '../study/list/LockGuard';
#   → import { LockGuard } from '@/components/study/list/LockGuard';
#
#   import { foo } from '../../utils/bar';
#   → import { foo } from '@/utils/bar';
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
TARGET_FILE=""
SRC_DIR="src"

# 도움말 출력
show_help() {
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}상대 경로 → 절대 경로(@/) 변환 스크립트${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  --dry-run       실제 변경 없이 변경될 내용만 미리보기"
    echo "  --file <path>   특정 파일만 변환"
    echo "  --help          도움말 표시"
    echo ""
    echo -e "${YELLOW}변환 규칙:${NC}"
    echo "  ../*, ../../*, ../../../* 등의 상대 경로를 @/* 절대 경로로 변환"
    echo ""
    echo -e "${CYAN}예시 (src/components/auth/File.tsx에서):${NC}"
    echo "  import { A } from '../study/list/A';"
    echo "  → import { A } from '@/components/study/list/A';"
    echo ""
    echo "  import { B } from '../../utils/B';"
    echo "  → import { B } from '@/utils/B';"
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
        --file)
            TARGET_FILE="$2"
            shift 2
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
echo -e "${BLUE}상대 경로 → 절대 경로(@/) 변환 시작${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY RUN 모드] 실제 파일은 변경되지 않습니다.${NC}"
    echo ""
fi

# 상대 경로를 절대 경로로 변환하는 함수
resolve_path() {
    local FILE_DIR="$1"      # 현재 파일이 있는 디렉토리 (src/components/auth)
    local RELATIVE_PATH="$2" # 상대 경로 (../study/list/LockGuard)

    # FILE_DIR에서 src/ 제거
    local BASE_DIR="${FILE_DIR#src/}"

    # 경로를 / 기준으로 배열로 분할
    IFS='/' read -ra BASE_PARTS <<< "$BASE_DIR"
    IFS='/' read -ra REL_PARTS <<< "$RELATIVE_PATH"

    # BASE_PARTS 복사
    local RESULT_PARTS=()
    for part in "${BASE_PARTS[@]}"; do
        RESULT_PARTS+=("$part")
    done

    # 상대 경로 처리
    for part in "${REL_PARTS[@]}"; do
        if [ "$part" = ".." ]; then
            # 상위 디렉토리: 마지막 요소 제거
            if [ ${#RESULT_PARTS[@]} -gt 0 ]; then
                unset 'RESULT_PARTS[${#RESULT_PARTS[@]}-1]'
            fi
        elif [ "$part" != "." ] && [ -n "$part" ]; then
            RESULT_PARTS+=("$part")
        fi
    done

    # 결과 경로 조합
    local RESULT=""
    for part in "${RESULT_PARTS[@]}"; do
        if [ -n "$part" ]; then
            if [ -n "$RESULT" ]; then
                RESULT="$RESULT/$part"
            else
                RESULT="$part"
            fi
        fi
    done

    echo "$RESULT"
}

# 패턴: from '로 시작하고 ../가 포함된 import
PATTERN="from ['\"]\.\./"

echo -e "${GREEN}[Import Path] 상대 경로 → 절대 경로(@/) 변환 중...${NC}"
echo ""

# 파일 목록 가져오기
if [ -n "$TARGET_FILE" ]; then
    if [ ! -f "$TARGET_FILE" ]; then
        echo -e "${RED}에러: 파일을 찾을 수 없습니다: $TARGET_FILE${NC}"
        exit 1
    fi
    FILE_LIST="$TARGET_FILE"
else
    FILE_LIST=$(grep -rlE "$PATTERN" "$SRC_DIR" --include="*.tsx" --include="*.ts" 2>/dev/null || true)
fi

if [ -z "$FILE_LIST" ]; then
    echo -e "  ${CYAN}변환할 항목 없음${NC}"
    echo ""
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}변환 완료${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
    echo -e "총 변환된 import 문: ${GREEN}0${NC}개"
    echo ""
    echo -e "${GREEN}완료!${NC}"
    exit 0
fi

# 총 변환 수 계산
TOTAL_MATCHES=$(echo "$FILE_LIST" | xargs grep -ohE "from ['\"]\.\.(/[^'\"]*)?['\"]" 2>/dev/null | wc -l | tr -d ' ')
FILE_COUNT=$(echo "$FILE_LIST" | wc -l | tr -d ' ')

# 임시 파일 생성 (변환 내용 저장용)
TEMP_SCRIPT=$(mktemp)
trap "rm -f $TEMP_SCRIPT" EXIT

# 각 파일 처리
echo "$FILE_LIST" | while IFS= read -r FILE; do
    if [ -z "$FILE" ]; then
        continue
    fi

    # 파일 디렉토리 추출
    FILE_DIR=$(dirname "$FILE")

    # 해당 파일에서 변환할 import 문 찾기
    MATCHES=$(grep -oE "from ['\"]\.\.(/[^'\"]*)?['\"]" "$FILE" 2>/dev/null || true)

    if [ -n "$MATCHES" ]; then
        echo -e "  ${CYAN}$FILE${NC}"

        # sed 명령어 생성
        SED_COMMANDS=""

        echo "$MATCHES" | while IFS= read -r MATCH; do
            if [ -z "$MATCH" ]; then
                continue
            fi

            # 상대 경로 추출 (from '../study/list/LockGuard' → ../study/list/LockGuard)
            RELATIVE_PATH=$(echo "$MATCH" | sed -E "s/from ['\"]([^'\"]+)['\"].*/\1/")

            # 절대 경로로 변환
            ABSOLUTE_PATH=$(resolve_path "$FILE_DIR" "$RELATIVE_PATH")

            # 새 import 경로
            NEW_PATH="@/$ABSOLUTE_PATH"

            echo -e "    ${YELLOW}$MATCH${NC}"
            echo -e "    → ${GREEN}from '$NEW_PATH'${NC}"

            # sed 명령어를 임시 파일에 추가
            if [ "$DRY_RUN" = false ]; then
                # 특수문자 이스케이프
                ESCAPED_OLD=$(echo "$RELATIVE_PATH" | sed 's/[\/&]/\\&/g')
                ESCAPED_NEW=$(echo "$NEW_PATH" | sed 's/[\/&]/\\&/g')
                echo "s|from ['\"]${ESCAPED_OLD}['\"]|from '${ESCAPED_NEW}'|g" >> "$TEMP_SCRIPT.${FILE//\//_}"
            fi
        done
        echo ""

        # 실제 변환 수행
        if [ "$DRY_RUN" = false ]; then
            SCRIPT_FILE="$TEMP_SCRIPT.${FILE//\//_}"
            if [ -f "$SCRIPT_FILE" ]; then
                if [[ "$OSTYPE" == "darwin"* ]]; then
                    sed -i '' -f "$SCRIPT_FILE" "$FILE"
                else
                    sed -i -f "$SCRIPT_FILE" "$FILE"
                fi
                rm -f "$SCRIPT_FILE"
            fi
        fi
    fi
done

# 결과 요약
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}변환 완료${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "변환된 파일: ${GREEN}$FILE_COUNT${NC}개"
echo -e "변환된 import 문: ${GREEN}$TOTAL_MATCHES${NC}개"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}[DRY RUN 모드] 실제 변환을 수행하려면 --dry-run 옵션을 제거하세요.${NC}"
    echo ""
    echo "실행 명령어:"
    echo -e "  ${GREEN}./scripts/convert-relative-imports.sh${NC}"
fi

echo ""
echo -e "${GREEN}완료!${NC}"
