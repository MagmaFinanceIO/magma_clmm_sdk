use alloy_primitives::U256;
use std::str::FromStr;

fn u256_max() -> U256 {
    U256::from_str("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF").unwrap()
}
fn u128_max() -> U256 {
    U256::from_str("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF").unwrap()
}

fn u64_max() -> U256 {
    U256::from_str("0xFFFFFFFFFFFFFFFF").unwrap()
}

fn u32_max() -> U256 {
    U256::from_str("0xFFFFFFFF").unwrap()
}

fn u16_max() -> U256 {
    U256::from_str("0xFFFF").unwrap()
}

fn u8_max() -> U256 {
    U256::from_str("0xFF").unwrap()
}

fn u4_max() -> U256 {
    U256::from_str("0xF").unwrap()
}

/**
 * @dev Returns the index of the most significant bit of x
 * This function returns 0 if x is 0
 * @param x The value as a uint256
 * @return msb The index of the most significant bit of x
 */
pub fn most_significant_bit(mut bits: U256) -> u8 {
    let mut msb = 0;
    if bits > u128_max() {
        bits = bits >> 128;
        msb = 128;
    };
    if bits > u64_max() {
        bits = bits >> 64;
        msb = msb + 64;
    };
    if bits > u32_max() {
        bits = bits >> 32;
        msb = msb + 32;
    };
    if bits > u16_max() {
        bits = bits >> 16;
        msb = msb + 16;
    };
    if bits > u8_max() {
        bits = bits >> 8;
        msb = msb + 8;
    };
    if bits > u4_max() {
        bits = bits >> 4;
        msb = msb + 4;
    };
    if bits > U256::from_str("0x3").unwrap() {
        bits = bits >> 2;
        msb = msb + 2;
    };
    if bits > U256::from_str("0x1").unwrap() {
        msb = msb + 1;
    };

    return msb;
}
