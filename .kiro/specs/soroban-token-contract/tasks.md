# Implementation Plan: Soroban Token Contract (Hybrid Model)

## Overview

Implement a SEP-41 compliant token contract on Stellar Soroban with SAC (Stellar Asset Contract) integration.
The contract lives at `stellar.tpad/contracts/token/` and is deployed to Stellar testnet.
Each task ends with a `git add && git commit && git push`.

## Tasks

- [-] 1. Setup Cargo.toml và project structure
  - Update `stellar.tpad/contracts/token/Cargo.toml` với đầy đủ dependencies: `soroban-sdk = { version = "22.0", features = ["alloc"] }`, dev-dependencies `soroban-sdk = { version = "22.0", features = ["testutils"] }` và `proptest = "1"`, release profile tối ưu WASM (`opt-level = "z"`, `lto = true`, `panic = "abort"`, v.v.)
  - Tạo file `stellar.tpad/contracts/token/src/test.rs` (rỗng, chỉ `#[cfg(test)] mod test {}`)
  - Cập nhật `stellar.tpad/contracts/token/src/lib.rs` để khai báo `mod test`
  - Verify `stellar contract build` chạy thành công (WASM output tại `target/wasm32-unknown-unknown/release/token.wasm`)
  - Chạy `git add && git commit -m "chore: setup Cargo.toml and project structure for token contract" && git push`
  - _Requirements: 10.1, 10.5_

- [ ] 2. Implement storage layer (types.rs + storage.rs)
  - [ ] 2.1 Implement `stellar.tpad/contracts/token/src/types.rs`
    - Định nghĩa `DataKey` enum với variants: `Admin`, `Decimals`, `Name`, `Symbol`, `Sac`, `Balance(Address)`, `Allowance(AllowanceKey)` — tất cả annotate `#[contracttype]`
    - Định nghĩa `AllowanceKey { from: Address, spender: Address }` với `#[contracttype]`
    - Định nghĩa `AllowanceValue { amount: i128, expiration_ledger: u32 }` với `#[contracttype]`
    - Định nghĩa `TokenError` enum với `#[contracterror]`: `AlreadyInitialized=1`, `NotInitialized=2`, `Unauthorized=3`, `InvalidAmount=4`, `InsufficientBalance=5`, `InsufficientAllowance=6`, `InvalidExpirationLedger=7`
    - _Requirements: 1.5, 3.4, 3.5, 4.4, 4.5, 5.5, 5.6, 6.4, 6.5, 7.5, 7.6, 8.5_

  - [ ] 2.2 Implement `stellar.tpad/contracts/token/src/storage.rs`
    - Viết helper `read_balance(env, addr) -> i128` — đọc từ persistent storage, default `0`
    - Viết helper `write_balance(env, addr, amount)`
    - Viết helper `read_allowance(env, from, spender) -> i128` — đọc từ temporary storage, kiểm tra `expiration_ledger`, trả về `0` nếu expired
    - Viết helper `write_allowance(env, from, spender, amount, expiration_ledger)` — lưu vào temporary storage, extend TTL đến `expiration_ledger`
    - Viết helpers cho metadata: `read_admin`, `write_admin`, `read_decimals`, `write_decimals`, `read_name`, `write_name`, `read_symbol`, `write_symbol`, `read_sac`, `write_sac`
    - _Requirements: 2.4, 2.6, 2.7, 3.3, 3.6_

  - [ ] 2.3 Cập nhật `lib.rs` để re-export types và storage modules
    - Chạy `cargo test` để verify compile
    - Chạy `git add && git commit -m "feat: implement storage layer (types.rs + storage.rs)" && git push`
    - _Requirements: 1.5_

- [ ] 3. Implement SEP-41 read interface
  - [ ] 3.1 Implement contract struct và `#[contractimpl]` block trong `lib.rs`
    - Khai báo `pub struct TokenContract;`
    - Implement `decimals(env: Env) -> u32` — đọc từ persistent storage
    - Implement `name(env: Env) -> String` — đọc từ persistent storage
    - Implement `symbol(env: Env) -> String` — đọc từ persistent storage
    - Implement `balance(env: Env, id: Address) -> i128` — gọi `read_balance`, default `0`
    - Implement `allowance(env: Env, from: Address, spender: Address) -> i128` — gọi `read_allowance`, trả về `0` nếu expired
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ]* 3.2 Viết unit tests cho read interface trong `test.rs`
    - `test_balance_default_zero`: balance của địa chỉ mới = 0
    - `test_allowance_default_zero`: allowance của cặp mới = 0
    - `test_decimals_name_symbol`: verify metadata sau initialize
    - Setup helper `fn setup() -> (Env, TokenContractClient, Address, Address)` dùng `env.register_stellar_asset_contract_v2`
    - _Requirements: 2.4, 2.6, 2.7, 11.1_

  - [ ] 3.3 Chạy `cargo test` — verify pass, rồi `git add && git commit -m "feat: implement SEP-41 read interface (balance, allowance, decimals, name, symbol)" && git push`
    - _Requirements: 2.1–2.7, 11.2_

- [ ] 4. Implement initialize và admin functions
  - [ ] 4.1 Implement `initialize(env, admin, decimal, name, symbol, sac)` trong `lib.rs`
    - Kiểm tra `AlreadyInitialized` nếu `Admin` key đã tồn tại
    - Gọi `admin.require_auth()`
    - Lưu tất cả metadata vào persistent storage qua storage helpers
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 4.2 Implement `admin(env) -> Address` và `set_admin(env, new_admin)`
    - `admin()`: đọc từ persistent storage
    - `set_admin()`: require_auth của admin hiện tại, cập nhật storage
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 4.3 Viết unit tests cho admin functions trong `test.rs`
    - `test_initialize_success`: initialize thành công, verify metadata
    - `test_initialize_twice_fails`: gọi initialize lần 2 → panic `AlreadyInitialized`
    - `test_set_admin_success`: set_admin thành công, verify admin mới
    - `test_set_admin_unauthorized`: non-admin gọi set_admin → panic `Unauthorized`
    - `test_admin_query`: `admin()` trả về đúng địa chỉ
    - _Requirements: 1.3, 9.4, 11.1, 11.3_

  - [ ] 4.4 Chạy `cargo test` — verify pass, rồi `git add && git commit -m "feat: implement initialize and admin functions" && git push`
    - _Requirements: 1.1–1.5, 9.1–9.5, 11.2_

- [ ] 5. Implement approve + allowance management
  - [ ] 5.1 Implement `approve(env, from, spender, amount, expiration_ledger)` trong `lib.rs`
    - Gọi `from.require_auth()`
    - Validate `amount >= 0` → panic `InvalidAmount` nếu âm
    - Validate `expiration_ledger >= env.ledger().sequence()` khi `amount > 0` → panic `InvalidExpirationLedger`
    - Gọi `write_allowance` để lưu vào temporary storage với TTL
    - Emit event `approve` với topics `(symbol_short!("approve"), from, spender)` và data `(amount, expiration_ledger)`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 Viết unit tests cho approve trong `test.rs`
    - `test_approve_and_query`: approve rồi query allowance → đúng amount
    - `test_approve_negative_amount`: approve với amount âm → panic `InvalidAmount`
    - `test_approve_expired_ledger`: approve với expiration_ledger < current → panic `InvalidExpirationLedger`
    - `test_allowance_expiration`: set allowance, advance ledger, query → 0
    - _Requirements: 3.2, 3.4, 3.5, 3.6, 11.1, 11.3, 11.6_

  - [ ]* 5.3 Viết property test `prop_approve_round_trip` (Property 3)
    - **Property 3: Approve Round-Trip**
    - **Validates: Requirements 3.3**
    - Với bất kỳ `amount in 0..1_000_000_i128` và `expiration_ledger` hợp lệ, sau `approve(from, spender, amount, exp)`, `allowance(from, spender)` phải trả về đúng `amount`
    - _Requirements: 3.3, 11.4_

  - [ ]* 5.4 Viết property test `prop_allowance_expiration` (Property 4)
    - **Property 4: Allowance Expiration**
    - **Validates: Requirements 3.6**
    - Với bất kỳ allowance đã set với `expiration_ledger` đã qua, `allowance(from, spender)` phải trả về `0`
    - _Requirements: 3.6, 11.4_

  - [ ] 5.5 Chạy `cargo test` — verify pass, rồi `git add && git commit -m "feat: implement approve and allowance management with property tests" && git push`
    - _Requirements: 3.1–3.6, 11.2_

- [ ] 6. Implement transfer + transfer_from
  - [ ] 6.1 Implement `transfer(env, from, to, amount)` trong `lib.rs`
    - Gọi `from.require_auth()`
    - Validate `amount > 0` → panic `InvalidAmount`
    - Kiểm tra `read_balance(from) >= amount` → panic `InsufficientBalance`
    - Cập nhật balance: `write_balance(from, balance_from - amount)`, `write_balance(to, balance_to + amount)`
    - Emit event `transfer` với topics `(symbol_short!("transfer"), from, to)` và data `amount`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ] 6.2 Implement `transfer_from(env, spender, from, to, amount)` trong `lib.rs`
    - Gọi `spender.require_auth()`
    - Kiểm tra `read_allowance(from, spender) >= amount` → panic `InsufficientAllowance`
    - Kiểm tra `read_balance(from) >= amount` → panic `InsufficientBalance`
    - Giảm allowance: `write_allowance(from, spender, allowance - amount, expiration_ledger)`
    - Cập nhật balance giống `transfer`
    - Emit event `transfer`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ]* 6.3 Viết unit tests cho transfer trong `test.rs`
    - `test_transfer_success`: transfer hợp lệ, verify balance from/to
    - `test_transfer_invalid_amount`: amount <= 0 → panic `InvalidAmount`
    - `test_transfer_insufficient_balance`: balance < amount → panic `InsufficientBalance`
    - `test_transfer_from_success`: transfer_from hợp lệ, verify balance và allowance giảm
    - `test_transfer_from_insufficient_allowance`: allowance < amount → panic `InsufficientAllowance`
    - _Requirements: 4.4, 4.5, 5.5, 5.6, 11.1, 11.3_

  - [ ]* 6.4 Viết property test `prop_transfer_balance_delta` (Property 2)
    - **Property 2: Transfer Balance Delta**
    - **Validates: Requirements 4.3, 4.7**
    - Với bất kỳ `initial_from in 1..1_000_000_i128` và `amount in 1..500_000_i128` (prop_assume `initial_from >= amount`), sau `transfer(from, to, amount)`: `balance(from) == before - amount` và `balance(to) == before + amount`
    - _Requirements: 4.3, 4.7, 11.4_

  - [ ]* 6.5 Viết property test `prop_transfer_from_reduces_allowance` (Property 5)
    - **Property 5: Transfer From Reduces Allowance**
    - **Validates: Requirements 5.3, 5.4**
    - Với bất kỳ `allowance_amount in 1..1_000_000_i128` và `transfer_amount in 1..500_000_i128` (prop_assume `allowance_amount >= transfer_amount`), sau `transfer_from`: `allowance(from, spender) == allowance_before - transfer_amount`
    - _Requirements: 5.3, 5.4, 11.4_

  - [ ] 6.6 Chạy `cargo test` — verify pass, rồi `git add && git commit -m "feat: implement transfer and transfer_from with property tests" && git push`
    - _Requirements: 4.1–4.7, 5.1–5.7, 11.2_

- [ ] 7. Implement burn + burn_from
  - [ ] 7.1 Implement `burn(env, from, amount)` trong `lib.rs`
    - Gọi `from.require_auth()`
    - Validate `amount > 0` → panic `InvalidAmount`
    - Kiểm tra `read_balance(from) >= amount` → panic `InsufficientBalance`
    - Cập nhật: `write_balance(from, balance - amount)`
    - Emit event `burn` với topics `(symbol_short!("burn"), from)` và data `amount`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ] 7.2 Implement `burn_from(env, spender, from, amount)` trong `lib.rs`
    - Gọi `spender.require_auth()`
    - Kiểm tra `read_allowance(from, spender) >= amount` → panic `InsufficientAllowance`
    - Kiểm tra `read_balance(from) >= amount` → panic `InsufficientBalance`
    - Giảm allowance, giảm balance
    - Emit event `burn`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 7.3 Viết unit tests cho burn trong `test.rs`
    - `test_burn_success`: burn hợp lệ, verify balance giảm
    - `test_burn_invalid_amount`: amount <= 0 → panic `InvalidAmount`
    - `test_burn_insufficient_balance`: balance < amount → panic `InsufficientBalance`
    - `test_burn_from_success`: burn_from hợp lệ, verify balance và allowance giảm
    - `test_burn_from_insufficient_allowance`: allowance < amount → panic `InsufficientAllowance`
    - _Requirements: 6.4, 6.5, 7.5, 7.6, 11.1, 11.3_

  - [ ]* 7.4 Viết property test `prop_burn_reduces_balance` (Property 6)
    - **Property 6: Burn Reduces Balance**
    - **Validates: Requirements 6.3**
    - Với bất kỳ `initial in 1..1_000_000_i128` và `amount in 1..500_000_i128` (prop_assume `initial >= amount`), sau `burn(from, amount)`: `balance(from) == initial - amount`
    - _Requirements: 6.3, 11.4_

  - [ ]* 7.5 Viết property test `prop_burn_from_reduces_allowance` (Property 9)
    - **Property 9: Burn From Reduces Allowance**
    - **Validates: Requirements 7.3, 7.4**
    - Với bất kỳ `allowance_amount in 1..1_000_000_i128` và `burn_amount in 1..500_000_i128` (prop_assume `allowance_amount >= burn_amount`), sau `burn_from`: `allowance(from, spender) == allowance_before - burn_amount`
    - _Requirements: 7.3, 7.4, 11.4_

  - [ ] 7.6 Chạy `cargo test` — verify pass, rồi `git add && git commit -m "feat: implement burn and burn_from with property tests" && git push`
    - _Requirements: 6.1–6.6, 7.1–7.7, 11.2_

- [ ] 8. Implement mint với SAC integration
  - [ ] 8.1 Implement `mint(env, to, amount)` trong `lib.rs`
    - Đọc admin từ storage, gọi `admin.require_auth()`
    - Validate `amount > 0` → panic `InvalidAmount`
    - Cộng amount vào internal balance: `write_balance(to, balance_to + amount)`
    - Gọi cross-contract SAC mint: `use soroban_sdk::token::StellarAssetClient; let sac = read_sac(&env); StellarAssetClient::new(&env, &sac).mint(&to, &amount)`
    - Emit event `mint` với topics `(symbol_short!("mint"), admin, to)` và data `amount`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [ ]* 8.2 Viết unit tests cho mint trong `test.rs`
    - `test_mint_success`: mint hợp lệ, verify `balance(to)` tăng đúng amount
    - `test_mint_invalid_amount`: amount <= 0 → panic `InvalidAmount`
    - `test_mint_unauthorized`: non-admin gọi mint → panic (auth failure)
    - Dùng `env.register_stellar_asset_contract_v2` để mock SAC trong tests
    - _Requirements: 8.2, 8.5, 11.1, 11.3_

  - [ ]* 8.3 Viết property test `prop_mint_increases_balance` (Property 7)
    - **Property 7: Mint Increases Balance**
    - **Validates: Requirements 8.3, 8.7**
    - Với bất kỳ `amount in 1..1_000_000_i128`, sau `mint(to, amount)`: `balance(to) == balance_before + amount`
    - _Requirements: 8.3, 8.7, 11.4_

  - [ ]* 8.4 Viết property test `prop_mint_burn_round_trip` (Property 8)
    - **Property 8: Mint-Burn Round Trip**
    - **Validates: Requirements 11.5**
    - Với bất kỳ `amount in 1..1_000_000_i128`, sau `mint(to, amount)` rồi `burn(to, amount)`: `balance(to) == balance_original`
    - _Requirements: 11.5_

  - [ ] 8.5 Chạy `cargo test` — verify pass, rồi `git add && git commit -m "feat: implement mint with SAC integration and property tests" && git push`
    - _Requirements: 8.1–8.7, 11.2_

- [ ] 9. Checkpoint — Full test suite
  - Chạy `cargo test` từ `stellar.tpad/contracts/token/` — tất cả unit tests và property tests phải pass
  - Verify coverage: tất cả 9 public functions có unit test, tất cả 8 property tests (Properties 2–9) có proptest
  - Ensure all tests pass, ask the user if questions arise.
  - Chạy `git add && git commit -m "test: complete unit tests and property-based tests for all functions" && git push`
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 12.3_

- [ ] 10. Build WASM và verify
  - [ ] 10.1 Chạy `stellar contract build` từ `stellar.tpad/contracts/token/`
    - Verify output file tồn tại: `target/wasm32-unknown-unknown/release/token.wasm`
    - Kiểm tra file size hợp lý (< 100KB sau optimization)
    - _Requirements: 10.1, 10.2_

  - [ ] 10.2 Verify WASM binary với `stellar contract inspect`
    - Chạy `stellar contract inspect --wasm target/wasm32-unknown-unknown/release/token.wasm`
    - Verify tất cả 11 public functions xuất hiện trong output: `initialize`, `balance`, `allowance`, `approve`, `transfer`, `transfer_from`, `burn`, `burn_from`, `decimals`, `name`, `symbol`, `mint`, `set_admin`, `admin`
    - _Requirements: 10.1, 10.5_

  - [ ] 10.3 Chạy `git add && git commit -m "build: compile WASM binary and verify contract interface" && git push`
    - _Requirements: 10.1, 10.2, 12.1_

- [ ] 11. Deploy lên Stellar testnet
  - [ ] 11.1 Setup Stellar CLI và fund account
    - Chạy `stellar keys generate admin --network testnet` (nếu chưa có)
    - Chạy `stellar keys fund admin --network testnet` để fund XLM
    - Verify account funded: `stellar keys address admin`
    - _Requirements: 10.3_

  - [ ] 11.2 Deploy Token Contract lên testnet
    - Chạy `stellar contract deploy --wasm target/wasm32-unknown-unknown/release/token.wasm --source admin --network testnet`
    - Lưu contract ID (dạng `C...` 56 ký tự) vào biến môi trường
    - _Requirements: 10.3, 10.4_

  - [ ] 11.3 Initialize contract trên testnet
    - Cần SAC address (deploy SAC trước nếu chưa có, hoặc dùng existing SAC)
    - Chạy `stellar contract invoke --id C<contract_id> --source admin --network testnet -- initialize --admin $(stellar keys address admin) --decimal 7 --name "TPad Token" --symbol "TPAD" --sac C<sac_address>`
    - _Requirements: 1.1, 10.3_

  - [ ] 11.4 Verify deployment
    - Chạy `stellar contract invoke --id C<contract_id> --network testnet -- symbol` → verify output `"TPAD"`
    - Chạy `stellar contract invoke --id C<contract_id> --network testnet -- decimals` → verify output `7`
    - Chạy `stellar contract invoke --id C<contract_id> --network testnet -- name` → verify output `"TPad Token"`
    - _Requirements: 10.3, 10.4_

- [ ] 12. Lưu contract ID và final git push
  - [ ] 12.1 Lưu contract ID vào config
    - Thêm `TOKEN_CONTRACT_ID=C<contract_id>` vào `stellar.tpad/.env.local`
    - Thêm `TOKEN_CONTRACT_ID=C<contract_id>` vào `stellar.tpad/.env.local.example` (dùng placeholder)
    - Cập nhật `stellar.tpad/contracts/scripts/config.ts` với contract ID mới nếu cần
    - _Requirements: 10.4, 12.4_

  - [ ] 12.2 Final commit và push
    - Chạy `git add && git commit -m "deploy: deploy token contract to Stellar testnet, save contract ID" && git push`
    - _Requirements: 12.1, 12.2, 12.4_

- [ ] 13. Final checkpoint — Ensure all tests pass
  - Chạy `cargo test` lần cuối từ `stellar.tpad/contracts/token/` — verify 100% pass
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 11.2_

## Notes

- Tasks đánh dấu `*` là optional (test tasks) — có thể skip để MVP nhanh hơn, nhưng khuyến khích giữ lại
- Mỗi task kết thúc bằng `git add && git commit && git push` theo Requirement 12
- Property tests dùng `proptest` crate, chạy tối thiểu 100 iterations mỗi property
- SAC mock trong tests dùng `env.register_stellar_asset_contract_v2(admin)` từ `soroban-sdk testutils`
- Deploy testnet yêu cầu Stellar CLI đã cài và có kết nối internet
- Contract ID sau deploy phải được lưu vào `.env.local` (Requirement 12.4)
- Tất cả 9 correctness properties từ design document đều có property test tương ứng (Properties 2–9, Property 1 bị subsume bởi Property 2)
