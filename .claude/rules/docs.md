# 문서 규약

> Applies to: `README.md`, `README.en.md`, `docs/**/*.md`

이 레포의 사람이 읽는 문서는 **guk-lab 공통 규약**을 따릅니다. 정본은
`~/sonix/toy/guk-lab-docs` 이고, 여기로 복사하지 않고 가리킵니다 — 사본은
원본이 바뀌어도 안 바뀌기 때문입니다.

| 규약 | 정본 |
|---|---|
| 톤앤매너 | `guk-lab-docs/STYLE.md` |
| 다이어그램 | `guk-lab-docs/harness/skills/doc-diagrams/SKILL.md` |
| 브랜치·PR | `guk-lab-docs/playbooks/branching.md` |

## 요약 — 문서를 고치기 전에 확인할 것

- **본문은 습니다체**("~했습니다 / ~입니다"). 반말 단정체("~한다")와 해요체
  ("~해요")는 쓰지 않습니다.
- **헤드는 명사형**입니다 — 제목 옆 한 줄 요약, 표 셀, GitHub About 설명.
  헤드 자리에서 "~습니다"로 끝나면 어색합니다.
- **헤딩은 기술 명사구**로 씁니다 (`설계 대상 — 방식/결정`). 구호·은유·질문형
  헤딩은 본문 첫 문장으로 내립니다.
- **수치에는 측정 시점을 붙입니다.** 근거 없는 문장은 쓰지 않습니다.
- `README.md` 를 고치면 **`README.en.md` 도 같은 커밋에서** 고칩니다.
  상단 스위처는 `**한국어** | [English](README.en.md)` 형식입니다.
- 에이전트 지시문(`.claude/rules/`, `CLAUDE.md`)은 지시체를 유지합니다 —
  기계가 읽는 글은 짧고 명확한 쪽이 우선입니다.

## 다이어그램

- 아키텍처 도해는 **pig-ma 자신의 Mermaid import** 로 그립니다 (도그푸딩).
  `docs/diagrams/<name>.mmd` 가 정본이고 `.png` 는 렌더 결과입니다.
- 색은 의미를 나릅니다: `core`(핵심 불변식) · `view`(표현 계층) ·
  `store`(저장소) · `external`(외부 시스템) · `tool`(런타임 밖 도구).
  `classDef` 로 `.mmd` 안에서 지정합니다.
- **점선은 런타임 밖 경로에만** 씁니다 (검증 하네스 등). 이벤트는 실선입니다.
- 구조가 바뀌면 `.mmd` 를 고치고 PNG 를 다시 뽑습니다. PNG 만 고치면 다음
  갱신 때 어긋납니다.
