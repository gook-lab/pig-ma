#!/usr/bin/env bash

# ============================================================
# Prettier 코드 포매팅 스크립트
# ============================================================
# 사용법: ./scripts/format-code.sh [옵션]
#
# 옵션:
#   --check         실제 변경 없이 포매팅 필요한 파일만 확인
#   --staged        스테이징된 파일만 포매팅
#   --src           src 폴더만 포매팅 (기본값)
#   --all           프로젝트 전체 포매팅
#   --help          도움말 표시
#
# 예시:
#   ./scripts/format-code.sh              # src 폴더 포매팅
#   ./scripts/format-code.sh --check      # 변경 필요한 파일 확인만
#   ./scripts/format-code.sh --staged     # 스테이징된 파일만 포매팅
#   ./scripts/format-code.sh --all        # 프로젝트 전체 포매팅
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
CHECK_ONLY=false
STAGED_ONLY=false
TARGET="src"
EXTENSIONS="ts,tsx,js,jsx,json,css,scss,html"

# 도움말 출력
show_help() {
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}Prettier 코드 포매팅 스크립트${NC}"
    echo -e "${BLUE}============================================================${NC}"
    echo ""
    echo "사용법: $0 [옵션]"
    echo ""
    echo "옵션:"
    echo "  --check         실제 변경 없이 포매팅 필요한 파일만 확인"
    echo "  --staged        스테이징된 파일만 포매팅"
    echo "  --src           src 폴더만 포매팅 (기본값)"
    echo "  --all           프로젝트 전체 포매팅"
    echo "  --help          도움말 표시"
    echo ""
    echo -e "${YELLOW}대상 파일 확장자:${NC}"
    echo "  .ts, .tsx, .js, .jsx, .json, .css, .scss, .html"
    echo ""
    echo -e "${YELLOW}예시:${NC}"
    echo "  $0                  # src 폴더 포매팅"
    echo "  $0 --check          # 변경 필요한 파일 확인만"
    echo "  $0 --staged         # git 스테이징된 파일만 포매팅"
    echo "  $0 --all            # 프로젝트 전체 포매팅"
    echo ""
    exit 0
}

# 인자 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        --check)
            CHECK_ONLY=true
            shift
            ;;
        --staged)
            STAGED_ONLY=true
            shift
            ;;
        --src)
            TARGET="src"
            shift
            ;;
        --all)
            TARGET="."
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
if [ ! -f "package.json" ]; then
    echo -e "${RED}에러: package.json을 찾을 수 없습니다.${NC}"
    echo "프로젝트 루트에서 스크립트를 실행해주세요."
    exit 1
fi

# Prettier 설치 확인
if ! command -v npx &> /dev/null; then
    echo -e "${RED}에러: npx를 찾을 수 없습니다. Node.js가 설치되어 있는지 확인하세요.${NC}"
    exit 1
fi

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}Prettier 코드 포매팅${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# 스테이징된 파일만 처리
if [ "$STAGED_ONLY" = true ]; then
    echo -e "${CYAN}스테이징된 파일 대상으로 포매팅 중...${NC}"
    echo ""

    # 스테이징된 파일 목록 가져오기
    STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E "\.(ts|tsx|js|jsx|json|css|scss|html)$" || true)

    if [ -z "$STAGED_FILES" ]; then
        echo -e "${YELLOW}포매팅할 스테이징된 파일이 없습니다.${NC}"
        exit 0
    fi

    echo -e "${CYAN}대상 파일:${NC}"
    echo "$STAGED_FILES" | while read -r file; do
        echo -e "  ${GREEN}$file${NC}"
    done
    echo ""

    if [ "$CHECK_ONLY" = true ]; then
        echo -e "${YELLOW}[CHECK 모드] 포매팅 필요한 파일 확인 중...${NC}"
        echo ""
        echo "$STAGED_FILES" | xargs npx prettier --check
        EXIT_CODE=$?
    else
        echo -e "${GREEN}포매팅 적용 중...${NC}"
        echo ""
        echo "$STAGED_FILES" | xargs npx prettier --write
        EXIT_CODE=$?

        # 포매팅된 파일 다시 스테이징
        echo ""
        echo -e "${CYAN}포매팅된 파일을 다시 스테이징합니다...${NC}"
        echo "$STAGED_FILES" | xargs git add
    fi
else
    # 일반 모드 (폴더 대상)
    if [ "$TARGET" = "." ]; then
        echo -e "${CYAN}프로젝트 전체 대상으로 포매팅 중...${NC}"
        GLOB_PATTERN="**/*.{${EXTENSIONS}}"
    else
        echo -e "${CYAN}${TARGET} 폴더 대상으로 포매팅 중...${NC}"
        GLOB_PATTERN="${TARGET}/**/*.{${EXTENSIONS}}"
    fi
    echo ""

    if [ "$CHECK_ONLY" = true ]; then
        echo -e "${YELLOW}[CHECK 모드] 포매팅 필요한 파일 확인 중...${NC}"
        echo ""

        # --check 모드에서는 실패해도 에러로 처리하지 않음
        set +e
        npx prettier --check "$GLOB_PATTERN" 2>/dev/null
        EXIT_CODE=$?
        set -e

        if [ $EXIT_CODE -ne 0 ]; then
            echo ""
            echo -e "${YELLOW}위 파일들이 포매팅이 필요합니다.${NC}"
            echo -e "포매팅을 적용하려면: ${GREEN}./scripts/format-code.sh${NC}"
        else
            echo -e "${GREEN}모든 파일이 올바르게 포매팅되어 있습니다!${NC}"
        fi
    else
        echo -e "${GREEN}포매팅 적용 중...${NC}"
        echo ""
        npx prettier --write "$GLOB_PATTERN" 2>/dev/null
        EXIT_CODE=$?
    fi
fi

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}완료${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

if [ "$CHECK_ONLY" = true ]; then
    if [ $EXIT_CODE -eq 0 ]; then
        echo -e "${GREEN}모든 파일이 포매팅 규칙을 준수합니다.${NC}"
    else
        echo -e "${YELLOW}포매팅이 필요한 파일이 있습니다.${NC}"
        echo -e "실행 명령어: ${GREEN}./scripts/format-code.sh${NC}"
    fi
else
    echo -e "${GREEN}포매팅이 완료되었습니다!${NC}"
fi

echo ""
exit 0
