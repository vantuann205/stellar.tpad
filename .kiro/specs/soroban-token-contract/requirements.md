# Requirements Document

## Introduction

Feature này xây dựng một Soroban smart contract theo **Hybrid Model** trên Stellar testnet, kết hợp:
- **SEP-41 Token Interface** để xử lý toàn bộ logic token (bonding curve, DeFi operations)
- **Stellar Asset Contract (SAC)** để mint token thật vào ví người dùng

Mục tiêu: người dùng thấy token như một Stellar Asset bình thường trong ví (Freighter, Lobstr, v.v.), trong khi toàn bộ logic phức tạp (bonding curve, allowance, burn) được xử lý bởi Soroban contract.

Contract được đặt tại `stellar.tpad/contracts/token/` và deploy lên Stellar testnet bằng Stellar CLI.

---

## Glossary

- **Token_Contract**: Soroban smart contract chính, implement SEP-41 interface, nằm tại `stellar.tpad/contracts/token/`
- **SAC**: Stellar Asset Contract — contract chuẩn của Stellar để wrap một Stellar Classic Asset thành Soroban-compatible token
- **SEP-41**: Chuẩn giao diện token của Stellar ecosystem, tương đương ERC-20 trên Ethereum
- **Bonding_Curve**: Cơ chế định giá tự động dựa trên cung cầu, được implement trong `stellar.tpad/contracts/bonding_curve/`
- **Admin**: Địa chỉ Stellar có quyền khởi tạo và quản trị Token_Contract
- **Allowance**: Số lượng token mà một spender được phép chi tiêu thay mặt owner
- **Ledger**: Một block trên Stellar network, dùng làm đơn vị thời gian cho expiration
- **Testnet**: Mạng thử nghiệm của Stellar, dùng để phát triển và kiểm thử trước khi lên mainnet
- **Stellar_CLI**: Công cụ dòng lệnh `stellar` để build, deploy và tương tác với Soroban contracts
- **WASM**: WebAssembly binary được compile từ Rust, là artifact deploy lên Stellar

---

## Requirements

### Requirement 1: Khởi tạo Token Contract

**User Story:** As an Admin, I want to initialize the Token_Contract with metadata and SAC address, so that the token is properly configured before any operations.

#### Acceptance Criteria

1. THE Token_Contract SHALL expose an `initialize` function nhận các tham số: `admin: Address`, `decimal: u32`, `name: String`, `symbol: String`, `sac: Address`
2. WHEN `initialize` được gọi lần đầu, THE Token_Contract SHALL lưu trữ tất cả metadata vào persistent storage
3. IF `initialize` được gọi lần thứ hai, THEN THE Token_Contract SHALL trả về lỗi `AlreadyInitialized`
4. WHEN `initialize` được gọi, THE Token_Contract SHALL yêu cầu `admin` ký xác nhận (require_auth)
5. THE Token_Contract SHALL lưu `admin`, `decimal`, `name`, `symbol`, `sac` vào các storage key riêng biệt

---

### Requirement 2: SEP-41 Read Interface

**User Story:** As a user or DeFi protocol, I want to query token metadata and balances, so that I can display and use token information correctly.

#### Acceptance Criteria

1. THE Token_Contract SHALL expose hàm `decimals() -> u32` trả về số thập phân của token
2. THE Token_Contract SHALL expose hàm `name() -> String` trả về tên đầy đủ của token
3. THE Token_Contract SHALL expose hàm `symbol() -> String` trả về ký hiệu viết tắt của token
4. THE Token_Contract SHALL expose hàm `balance(id: Address) -> i128` trả về số dư token của địa chỉ `id`
5. THE Token_Contract SHALL expose hàm `allowance(from: Address, spender: Address) -> i128` trả về lượng token mà `spender` được phép dùng từ tài khoản `from`
6. WHEN `balance` được gọi với địa chỉ chưa có số dư, THE Token_Contract SHALL trả về `0`
7. WHEN `allowance` được gọi với cặp (from, spender) chưa được approve, THE Token_Contract SHALL trả về `0`

---

### Requirement 3: SEP-41 Approve và Allowance Management

**User Story:** As a token holder, I want to approve a spender to use my tokens, so that DeFi protocols can operate on my behalf.

#### Acceptance Criteria

1. THE Token_Contract SHALL expose hàm `approve(from: Address, spender: Address, amount: i128, expiration_ledger: u32)`
2. WHEN `approve` được gọi, THE Token_Contract SHALL yêu cầu `from` ký xác nhận (require_auth)
3. WHEN `approve` được gọi với `amount >= 0` và `expiration_ledger` hợp lệ, THE Token_Contract SHALL lưu allowance vào temporary storage với TTL là `expiration_ledger`
4. IF `amount` âm, THEN THE Token_Contract SHALL trả về lỗi `InvalidAmount`
5. IF `expiration_ledger` nhỏ hơn ledger hiện tại, THEN THE Token_Contract SHALL trả về lỗi `InvalidExpirationLedger`
6. WHEN allowance hết hạn (ledger vượt `expiration_ledger`), THE Token_Contract SHALL trả về `0` khi query `allowance`

---

### Requirement 4: SEP-41 Transfer

**User Story:** As a token holder, I want to transfer tokens to another address, so that I can send tokens to others.

#### Acceptance Criteria

1. THE Token_Contract SHALL expose hàm `transfer(from: Address, to: Address, amount: i128)`
2. WHEN `transfer` được gọi, THE Token_Contract SHALL yêu cầu `from` ký xác nhận (require_auth)
3. WHEN `transfer` được gọi với `amount > 0` và `balance(from) >= amount`, THE Token_Contract SHALL trừ `amount` từ `from` và cộng `amount` vào `to`
4. IF `amount <= 0`, THEN THE Token_Contract SHALL trả về lỗi `InvalidAmount`
5. IF `balance(from) < amount`, THEN THE Token_Contract SHALL trả về lỗi `InsufficientBalance`
6. WHEN `transfer` thành công, THE Token_Contract SHALL emit event `transfer` với các field `from`, `to`, `amount`
7. FOR ALL hợp lệ transfer operations: `balance(from)_after = balance(from)_before - amount` và `balance(to)_after = balance(to)_before + amount` (conservation property)

---

### Requirement 5: SEP-41 Transfer From (Delegated Transfer)

**User Story:** As a DeFi protocol or approved spender, I want to transfer tokens on behalf of a token holder, so that I can execute trades and operations automatically.

#### Acceptance Criteria

1. THE Token_Contract SHALL expose hàm `transfer_from(spender: Address, from: Address, to: Address, amount: i128)`
2. WHEN `transfer_from` được gọi, THE Token_Contract SHALL yêu cầu `spender` ký xác nhận (require_auth)
3. WHEN `transfer_from` được gọi, THE Token_Contract SHALL kiểm tra `allowance(from, spender) >= amount`
4. WHEN `transfer_from` thành công, THE Token_Contract SHALL giảm `allowance(from, spender)` đúng bằng `amount`
5. IF `allowance(from, spender) < amount`, THEN THE Token_Contract SHALL trả về lỗi `InsufficientAllowance`
6. IF `balance(from) < amount`, THEN THE Token_Contract SHALL trả về lỗi `InsufficientBalance`
7. WHEN `transfer_from` thành công, THE Token_Contract SHALL emit event `transfer` với các field `from`, `to`, `amount`

---

### Requirement 6: SEP-41 Burn

**User Story:** As a token holder, I want to burn my tokens, so that I can reduce the total supply (e.g., when selling via bonding curve).

#### Acceptance Criteria

1. THE Token_Contract SHALL expose hàm `burn(from: Address, amount: i128)`
2. WHEN `burn` được gọi, THE Token_Contract SHALL yêu cầu `from` ký xác nhận (require_auth)
3. WHEN `burn` được gọi với `amount > 0` và `balance(from) >= amount`, THE Token_Contract SHALL trừ `amount` từ số dư của `from`
4. IF `amount <= 0`, THEN THE Token_Contract SHALL trả về lỗi `InvalidAmount`
5. IF `balance(from) < amount`, THEN THE Token_Contract SHALL trả về lỗi `InsufficientBalance`
6. WHEN `burn` thành công, THE Token_Contract SHALL emit event `burn` với các field `from`, `amount`

---

### Requirement 7: SEP-41 Burn From (Delegated Burn)

**User Story:** As an approved spender, I want to burn tokens on behalf of a holder, so that protocols can reduce supply automatically.

#### Acceptance Criteria

1. THE Token_Contract SHALL expose hàm `burn_from(spender: Address, from: Address, amount: i128)`
2. WHEN `burn_from` được gọi, THE Token_Contract SHALL yêu cầu `spender` ký xác nhận (require_auth)
3. WHEN `burn_from` được gọi, THE Token_Contract SHALL kiểm tra `allowance(from, spender) >= amount`
4. WHEN `burn_from` thành công, THE Token_Contract SHALL giảm `allowance(from, spender)` đúng bằng `amount`
5. IF `allowance(from, spender) < amount`, THEN THE Token_Contract SHALL trả về lỗi `InsufficientAllowance`
6. IF `balance(from) < amount`, THEN THE Token_Contract SHALL trả về lỗi `InsufficientBalance`
7. WHEN `burn_from` thành công, THE Token_Contract SHALL emit event `burn` với các field `from`, `amount`

---

### Requirement 8: Mint thông qua SAC Integration

**User Story:** As an Admin or Bonding_Curve contract, I want to mint tokens into a user's wallet as real Stellar Assets, so that users can see and use the token in standard Stellar wallets.

#### Acceptance Criteria

1. THE Token_Contract SHALL expose hàm `mint(to: Address, amount: i128)`
2. WHEN `mint` được gọi, THE Token_Contract SHALL yêu cầu `admin` ký xác nhận (require_auth)
3. WHEN `mint` được gọi với `amount > 0`, THE Token_Contract SHALL cộng `amount` vào `balance(to)` trong internal storage
4. WHEN `mint` được gọi, THE Token_Contract SHALL gọi SAC `mint` function để mint token thật vào ví `to` trên Stellar network
5. IF `amount <= 0`, THEN THE Token_Contract SHALL trả về lỗi `InvalidAmount`
6. WHEN `mint` thành công, THE Token_Contract SHALL emit event `mint` với các field `to`, `amount`
7. WHEN `mint` thành công, THE Token_Contract SHALL đảm bảo `balance(to)_after = balance(to)_before + amount`

---

### Requirement 9: Admin Management

**User Story:** As an Admin, I want to transfer admin rights to another address, so that contract governance can be updated.

#### Acceptance Criteria

1. THE Token_Contract SHALL expose hàm `set_admin(new_admin: Address)`
2. WHEN `set_admin` được gọi, THE Token_Contract SHALL yêu cầu admin hiện tại ký xác nhận (require_auth)
3. WHEN `set_admin` thành công, THE Token_Contract SHALL cập nhật admin address trong persistent storage
4. IF `set_admin` được gọi bởi non-admin, THEN THE Token_Contract SHALL trả về lỗi `Unauthorized`
5. THE Token_Contract SHALL expose hàm `admin() -> Address` trả về địa chỉ admin hiện tại

---

### Requirement 10: Build và Deploy lên Testnet

**User Story:** As a developer, I want to build and deploy the Token_Contract to Stellar testnet, so that I can test the contract in a real network environment.

#### Acceptance Criteria

1. THE Token_Contract SHALL compile thành công thành WASM binary bằng lệnh `stellar contract build` trong thư mục `stellar.tpad/contracts/token/`
2. WHEN build thành công, THE Stellar_CLI SHALL tạo ra file WASM tại `target/wasm32-unknown-unknown/release/token.wasm`
3. THE Token_Contract SHALL deploy được lên Stellar testnet bằng lệnh `stellar contract deploy --network testnet`
4. WHEN deploy thành công, THE Stellar_CLI SHALL trả về contract ID dạng `C...` (56 ký tự)
5. THE Token_Contract SHALL có `Cargo.toml` đúng cấu hình với `soroban-sdk` dependency và `crate-type = ["cdylib"]`

---

### Requirement 11: Test Coverage

**User Story:** As a developer, I want comprehensive tests for all contract functions, so that I can verify correctness before deployment.

#### Acceptance Criteria

1. THE Token_Contract SHALL có unit tests cho tất cả 9 public functions: `initialize`, `balance`, `allowance`, `approve`, `transfer`, `transfer_from`, `burn`, `burn_from`, `mint`
2. WHEN tất cả tests chạy bằng `cargo test`, THE Token_Contract SHALL pass 100% test cases
3. THE Token_Contract SHALL có test kiểm tra error cases: `AlreadyInitialized`, `InvalidAmount`, `InsufficientBalance`, `InsufficientAllowance`, `Unauthorized`
4. THE Token_Contract SHALL có property-based test kiểm tra conservation: `balance(from) + balance(to)` không đổi sau `transfer` (tổng số dư được bảo toàn)
5. THE Token_Contract SHALL có property-based test kiểm tra round-trip: `mint(to, amount)` rồi `burn(to, amount)` trả về `balance(to)` về giá trị ban đầu
6. THE Token_Contract SHALL có test kiểm tra allowance expiration: allowance hết hạn sau `expiration_ledger`
7. WHEN tests chạy xong, THE developer SHALL git push kết quả lên repository

---

### Requirement 12: Git Workflow

**User Story:** As a developer, I want each completed task to be committed and pushed to git, so that progress is tracked and code is backed up.

#### Acceptance Criteria

1. WHEN một task hoàn thành, THE developer SHALL chạy `git add` và `git commit` với message mô tả rõ task
2. WHEN tests của một task pass, THE developer SHALL chạy `git push` để đẩy code lên remote
3. THE developer SHALL commit riêng biệt cho: contract implementation, tests, và deployment scripts
4. WHEN deploy thành công lên testnet, THE developer SHALL lưu contract ID vào file config và commit
