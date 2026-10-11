---
type: is
id: is-01ktybz8bcqs85bn6d1x5qegzh
title: Triage dev-tooling vulnerabilities reported by pnpm audit
kind: chore
status: open
priority: 2
version: 3
labels:
  - supply-chain
  - maintenance
dependencies: []
created_at: 2026-06-12T16:52:15.844Z
updated_at: 2026-10-11T02:05:00.094Z
---
PR #153 review validation: pnpm audit failed on 2026-06-12 with 16 dev-tooling vulnerabilities: 1 critical, 9 high, 6 moderate. Production audit was clean. Affected paths include vitest/vite/rollup, tsdown/defu, c8/test-exclude/minimatch/brace-expansion, tryscript/fast-glob/micromatch/picomatch, and typescript-eslint/tinyglobby/picomatch. Triage upgrades under the 14-day package-age policy and document any exception.

## Notes

Rechecked from the frozen lockfile on 2026-07-19 during PR #196 setup: 20 total advisories (1 critical, 10 high, 9 moderate). The affected dev-tool families remain Vitest/Vite/Rollup, tsdown/defu, c8/minimatch, tryscript/picomatch, and typescript-eslint/picomatch. No package was added or upgraded in PR #196.

2026-10-10 PDT PR324 checkpoint: full audit reports 47 dev-tree findings (14 moderate, 32 high, 1 critical); production audit is clean after removing gray-matter and ten unused packages, with no dependency additions/upgrades. Critical GHSA-5xrq-8626-4rwp concerns Vitest UI/API or Browser Mode (including Windows); current CI/package scripts run batch vitest run and coverage, with no --ui, --api, browser, or API configuration found. This does not resolve the broader developer-tool risk; this existing open bead retains upgrade/remediation ownership under package-age policy. Current advisory evidence:
- minimatch (high): https://github.com/advisories/GHSA-3ppc-4f35-3m26; vulnerable >=9.0.0 <9.0.6; patched >=9.0.6; paths: packages__tbd>c8>test-exclude>minimatch
- rollup (high): https://github.com/advisories/GHSA-mw96-cpmx-2vgc; vulnerable >=4.0.0 <4.59.0; patched >=4.59.0; paths: packages__tbd>vitest>vite>rollup
- minimatch (high): https://github.com/advisories/GHSA-7r86-cg39-jmmj; vulnerable >=9.0.0 <9.0.7; patched >=9.0.7; paths: packages__tbd>c8>test-exclude>minimatch
- minimatch (high): https://github.com/advisories/GHSA-23c5-xmqv-rm74; vulnerable >=9.0.0 <9.0.7; patched >=9.0.7; paths: packages__tbd>c8>test-exclude>minimatch
- brace-expansion (moderate): https://github.com/advisories/GHSA-f886-m6hf-6m8v; vulnerable >=2.0.0 <2.0.3; patched >=2.0.3; paths: packages__tbd>c8>test-exclude>minimatch>brace-expansion
- picomatch (moderate): https://github.com/advisories/GHSA-3v7f-55p6-f55p; vulnerable <2.3.2; patched >=2.3.2; paths: packages__tbd>tryscript>fast-glob>micromatch>picomatch
- picomatch (moderate): https://github.com/advisories/GHSA-3v7f-55p6-f55p; vulnerable >=4.0.0 <4.0.4; patched >=4.0.4; paths: .>typescript-eslint>@typescript-eslint/typescript-estree>tinyglobby>picomatch
- picomatch (high): https://github.com/advisories/GHSA-c2c7-rcm5-vvqj; vulnerable <2.3.2; patched >=2.3.2; paths: packages__tbd>tryscript>fast-glob>micromatch>picomatch
- picomatch (high): https://github.com/advisories/GHSA-c2c7-rcm5-vvqj; vulnerable >=4.0.0 <4.0.4; patched >=4.0.4; paths: .>typescript-eslint>@typescript-eslint/typescript-estree>tinyglobby>picomatch
- defu (high): https://github.com/advisories/GHSA-737v-mqg7-c878; vulnerable <=6.1.4; patched >=6.1.5; paths: packages__tbd>tsdown>defu
- vite (moderate): https://github.com/advisories/GHSA-4w7w-66w2-5vf9; vulnerable >=7.0.0 <=7.3.1; patched >=7.3.2; paths: packages__tbd>vitest>vite
- vite (high): https://github.com/advisories/GHSA-v2wj-q39q-566r; vulnerable >=7.1.0 <=7.3.1; patched >=7.3.2; paths: packages__tbd>vitest>vite
- vite (high): https://github.com/advisories/GHSA-p9ff-h696-f583; vulnerable >=7.0.0 <=7.3.1; patched >=7.3.2; paths: packages__tbd>vitest>vite
- postcss (moderate): https://github.com/advisories/GHSA-qx2v-qp2m-jg93; vulnerable <8.5.10; patched >=8.5.10; paths: packages__tbd>vitest>vite>postcss
- brace-expansion (moderate): https://github.com/advisories/GHSA-jxxr-4gwj-5jf2; vulnerable >=5.0.0 <5.0.6; patched >=5.0.6; paths: .>typescript-eslint>@typescript-eslint/typescript-estree>minimatch>brace-expansion
- vite (moderate): https://github.com/advisories/GHSA-v6wh-96g9-6wx3; vulnerable >=7.0.0 <=7.3.4; patched >=7.3.5; paths: packages__tbd>vitest>vite
- vite (high): https://github.com/advisories/GHSA-fx2h-pf6j-xcff; vulnerable >=7.0.0 <=7.3.4; patched >=7.3.5; paths: packages__tbd>vitest>vite
- brace-expansion (high): https://github.com/advisories/GHSA-3jxr-9vmj-r5cp; vulnerable >=2.0.0 <2.1.2; patched >=2.1.2; paths: packages__tbd>c8>test-exclude>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-3jxr-9vmj-r5cp; vulnerable <1.1.16; patched >=1.1.16; paths: .>eslint>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-3jxr-9vmj-r5cp; vulnerable >=3.0.0 <5.0.7; patched >=5.0.7; paths: .>typescript-eslint>@typescript-eslint/typescript-estree>minimatch>brace-expansion
- postcss (high): https://github.com/advisories/GHSA-6g55-p6wh-862q; vulnerable <=8.5.11; patched >=8.5.12; paths: packages__tbd>vitest>vite>postcss
- brace-expansion (high): https://github.com/advisories/GHSA-mh99-v99m-4gvg; vulnerable <1.1.17; patched >=1.1.17; paths: .>eslint>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-mh99-v99m-4gvg; vulnerable >=2.0.0 <2.1.3; patched >=2.1.3; paths: packages__tbd>c8>test-exclude>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-mh99-v99m-4gvg; vulnerable >=4.0.0 <5.0.8; patched >=5.0.8; paths: .>typescript-eslint>@typescript-eslint/typescript-estree>minimatch>brace-expansion
- postcss (moderate): https://github.com/advisories/GHSA-fxqj-rqcc-2cmp; vulnerable <=8.5.22; patched >=8.5.23; paths: packages__tbd>vitest>vite>postcss
- brace-expansion (high): https://github.com/advisories/GHSA-rgw5-rvv9-x895; vulnerable >=4.0.0 <5.0.9; patched >=5.0.9; paths: .>typescript-eslint>@typescript-eslint/typescript-estree>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-rgw5-rvv9-x895; vulnerable >=2.0.0 <2.1.4; patched >=2.1.4; paths: packages__tbd>c8>test-exclude>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-rgw5-rvv9-x895; vulnerable <1.1.18; patched >=1.1.18; paths: .>eslint>minimatch>brace-expansion
- nanoid (high): https://github.com/advisories/GHSA-28wg-ghj8-5hjv; vulnerable <3.3.16; patched >=3.3.16; paths: packages__tbd>vitest>vite>postcss>nanoid
- nanoid (high): https://github.com/advisories/GHSA-2v37-7h3g-55p8; vulnerable <3.3.18; patched >=3.3.18; paths: packages__tbd>vitest>vite>postcss>nanoid
- postcss (high): https://github.com/advisories/GHSA-r28c-9q8g-f849; vulnerable <=8.5.17; patched >=8.5.18; paths: packages__tbd>vitest>vite>postcss
- vitest (critical): https://github.com/advisories/GHSA-5xrq-8626-4rwp; vulnerable >=4.0.0 <4.1.0; patched >=4.1.0; paths: packages__tbd>vitest
- nanoid (high): https://github.com/advisories/GHSA-xwg4-73v4-xw9w; vulnerable <3.3.12; patched >=3.3.12; paths: packages__tbd>vitest>vite>postcss>nanoid
- @humanfs/node (moderate): https://github.com/advisories/GHSA-p498-v437-472g; vulnerable <0.16.8; patched >=0.16.8; paths: .>eslint>@humanfs/node
- vitest (moderate): https://github.com/advisories/GHSA-82fw-gwwq-j7x9; vulnerable >=2.1.0 <4.1.11; patched >=4.1.11; paths: packages__tbd>vitest
- @vitest/mocker (moderate): https://github.com/advisories/GHSA-82fw-gwwq-j7x9; vulnerable >=2.1.0 <4.1.11; patched >=4.1.11; paths: packages__tbd>vitest>@vitest/mocker
- brace-expansion (moderate): https://github.com/advisories/GHSA-q2hr-2g5m-vwhr; vulnerable <1.1.21; patched >=1.1.21; paths: .>eslint>minimatch>brace-expansion
- brace-expansion (moderate): https://github.com/advisories/GHSA-q2hr-2g5m-vwhr; vulnerable >=2.0.0 <2.1.7; patched >=2.1.7; paths: packages__tbd>c8>test-exclude>minimatch>brace-expansion
- brace-expansion (moderate): https://github.com/advisories/GHSA-q2hr-2g5m-vwhr; vulnerable >=4.0.0 <5.0.12; patched >=5.0.12; paths: .>typescript-eslint>@typescript-eslint/typescript-estree>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-qhr7-859c-m2p7; vulnerable <1.1.20; patched >=1.1.20; paths: .>eslint>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-qhr7-859c-m2p7; vulnerable >=2.0.0 <2.1.6; patched >=2.1.6; paths: packages__tbd>c8>test-exclude>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-qhr7-859c-m2p7; vulnerable >=4.0.0 <5.0.11; patched >=5.0.11; paths: .>typescript-eslint>@typescript-eslint/typescript-estree>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-6j4f-fj2g-mc7p; vulnerable <1.1.19; patched >=1.1.19; paths: .>eslint>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-6j4f-fj2g-mc7p; vulnerable >=2.0.0 <2.1.5; patched >=2.1.5; paths: packages__tbd>c8>test-exclude>minimatch>brace-expansion
- brace-expansion (high): https://github.com/advisories/GHSA-6j4f-fj2g-mc7p; vulnerable >=4.0.0 <5.0.10; patched >=5.0.10; paths: .>typescript-eslint>@typescript-eslint/typescript-estree>minimatch>brace-expansion
- braces (high): https://github.com/advisories/GHSA-vfj7-8cjw-p6xm; vulnerable <=3.0.3; patched <0.0.0; paths: packages__tbd>tryscript>fast-glob>micromatch>braces
- source-map-js (high): https://github.com/advisories/GHSA-68fv-2mgg-jv7q; vulnerable >=1.0.0 <1.2.2; patched >=1.2.2; paths: packages__tbd>@vitest/coverage-v8>magicast>source-map-js
