use wasm_bindgen::prelude::*;

use alloy_primitives::U256;
use std::collections::HashMap;

use crate::{constants, price, uint_safe};

#[wasm_bindgen]
pub struct DlmmPair {
    params: DlmmPairParameter,
    bins: HashMap<u32, Bin>,
    bin_step: u16,
}

#[wasm_bindgen]
pub struct SwapOutResult {
    pub amount_in_left: u64,
    pub amount_out: u64,
    pub fee: u64,
}

#[wasm_bindgen]
pub struct SwapInResult {
    pub amount_in: u64,
    pub amount_out_left: u64,
    pub fee: u64,
}

#[wasm_bindgen]
pub fn get_swap_out(
    pair: &DlmmPair,
    amount_in: u64,
    swap_for_y: bool,
    timestamp_ms: u64,
) -> SwapOutResult {
    let mut amount_in_left = amount_in;
    let mut params = pair.params.clone();
    let mut id = params.active_index;

    // TODO: Should use realtime timestamp
    params.update_references(timestamp_ms / 1000);

    let mut fee = 0;
    let mut amount_out = 0;

    loop {
        let bin = pair.bins.get(&id).unwrap();
        let bin_reserve = if swap_for_y {
            bin.reserve_y
        } else {
            bin.reserve_x
        };

        if bin_reserve > 0 {
            params.update_volatility_accumulator(id);

            let total_fee = params.get_total_fee(pair.bin_step);
            let (
                amounts_in_with_fees_x,
                amounts_in_with_fees_y,
                amounts_out_of_bin_x,
                amounts_out_of_bin_y,
                total_fees_x,
                total_fees_y,
            ) = bin::get_amounts(
                bin.reserve_x,
                bin.reserve_y,
                pair.bin_step,
                total_fee,
                swap_for_y,
                id,
                amount_in_left,
            );

            if amounts_in_with_fees_x > 0 && swap_for_y {
                amount_in_left = amount_in_left - amounts_in_with_fees_x;
                amount_out = amount_out + amounts_out_of_bin_y;
                fee = fee + total_fees_x;
            } else if amounts_in_with_fees_y > 0 && !swap_for_y {
                amount_in_left = amount_in_left - amounts_in_with_fees_y;
                amount_out = amount_out + amounts_out_of_bin_x;
                fee = fee + total_fees_y;
            };
        };

        if amount_in_left == 0 {
            break;
        } else {
            let (next_id, found) = pair.get_next_non_empty_bin_internal(swap_for_y, id);
            if !found {
                break;
            };
            id = next_id;
        };
    }

    SwapOutResult {
        amount_in_left,
        amount_out,
        fee,
    }
}

#[wasm_bindgen]
pub fn get_swap_in(
    pair: &DlmmPair,
    amount_out: u64,
    swap_for_y: bool,
    timestamp_ms: u64,
) -> SwapInResult {
    let mut params = pair.params.clone();

    let mut amount_out_left = amount_out;
    let mut id = params.active_index;

    params.update_references(timestamp_ms / 1000);

    let mut amount_in = 0;
    let mut fee = 0;

    loop {
        let bin = pair.bins.get(&id).unwrap();
        let bin_reserve = if swap_for_y {
            bin.reserve_y
        } else {
            bin.reserve_x
        };

        if bin_reserve > 0 {
            let price_q128 = price::get_price_x128_from_storage_id(id, pair.bin_step);
            let amount_out_of_bin = if bin_reserve > amount_out_left {
                amount_out_left
            } else {
                bin_reserve
            };

            params.update_volatility_accumulator(id);

            let amount_in_without_fee = if swap_for_y {
                (U256::from(amount_out_of_bin) << U256::from(constants::SCALE_OFFSET)) / price_q128
            } else {
                (U256::from(amount_out_of_bin) * price_q128) >> U256::from(constants::SCALE_OFFSET)
            };
            let amount_in_without_fee = uint_safe::safe64(amount_in_without_fee);

            let total_fee = params.get_total_fee(pair.bin_step);
            let fee_amount = fee::get_fee_amount_from(amount_in_without_fee, total_fee);

            amount_in = amount_in + amount_in_without_fee + fee_amount;
            amount_out_left = amount_out_left - amount_out_of_bin;
            fee = fee + fee_amount;
        };

        if amount_out_left == 0 {
            break;
        } else {
            let (next_id, found) = pair.get_next_non_empty_bin_internal(swap_for_y, id);
            if !found {
                break;
            };
            id = next_id;
        };
    }

    SwapInResult {
        amount_in,
        amount_out_left,
        fee,
    }
}

impl DlmmPair {
    fn get_next_non_empty_bin_internal(&self, swap_for_y: bool, id: u32) -> (u32, bool) {
        if swap_for_y {
            self.find_first_left(id)
        } else {
            self.find_first_right(id)
        }
    }

    fn find_first_left(&self, id: u32) -> (u32, bool) {
        let mut out = (1u32 << 24, false);
        for &_id in self.bins.keys() {
            if _id > id && _id < out.0 {
                out = (_id, true);
            }
        }
        out
    }

    fn find_first_right(&self, id: u32) -> (u32, bool) {
        let mut out = (0, false);
        for &_id in self.bins.keys() {
            if _id < id && _id > out.0 {
                out = (_id, true);
            }
        }
        out
    }
}

pub struct Bin {
    storage_id: u32,
    price_q128: U256,
    reserve_x: u64,
    reserve_y: u64,

    fee_growth_x: U256,
    fee_growth_y: U256,
    rewarder_growth: Vec<U256>,
    distribution_growth: U256,
}

#[derive(Clone, Debug)]
pub struct DlmmPairParameter {
    base_factor: u16,                // 16bit, basis_point
    filter_period: u16,              // 12bit
    decay_period: u16,               // 12bit
    reduction_factor: u16,           // 14bit
    variable_fee_control: u32,       // 24bit, basis_point
    protocol_share: u16,             // 14bit
    max_volatility_accumulator: u32, // 20bit, basis_point
    volatility_accumulator: u32,     // 20bit, basis_point
    volatility_reference: u32,       // 20bit
    index_reference: u32,            // 24bit
    time_of_last_update: u64,
    oracle_index: u16,
    active_index: u32, // 24bit
}

impl DlmmPairParameter {
    pub fn get_total_fee(&self, bin_step: u16) -> u64 {
        self.get_base_fee(bin_step) + self.get_variable_fee(bin_step)
    }

    fn get_base_fee(&self, bin_step: u16) -> u64 {
        // Base factor is in basis points: 10000
        // binStep is in basis points: 100000
        // 1e9
        (self.base_factor as u64) * (bin_step as u64)
    }

    fn get_variable_fee(&self, bin_step: u16) -> u64 {
        if self.variable_fee_control != 0 {
            // The volatility accumulator is in basis points, binStep is in basis points,
            // and the variable fee control is in basis points, so the result is in 100e18th
            let prod = U256::from(self.volatility_accumulator) * U256::from(bin_step);
            ((prod * prod * U256::from(self.variable_fee_control) + U256::from(99))
                / U256::from(100)
                / U256::from(1_000_000_000))
            .to::<u64>()
        } else {
            0
        }
    }

    pub fn update_volatility_parameters(&mut self, active_id: u32, timestamp: u64) {
        self.update_references(timestamp);
        self.update_volatility_accumulator(active_id);
    }

    fn update_references(&mut self, timestamp: u64) {
        let dt = timestamp - self.time_of_last_update;
        if dt >= self.filter_period as u64 {
            self.update_id_reference();
            if dt < self.decay_period as u64 {
                self.update_volatility_reference();
            } else {
                self.volatility_reference = 0;
            };
        };
        self.update_time_of_last_update(timestamp);
    }

    fn update_volatility_accumulator(&mut self, active_id: u32) {
        let id_reference = self.index_reference;
        let delta_id = if active_id > id_reference {
            active_id - id_reference
        } else {
            id_reference - active_id
        };
        let mut vol_acc =
            self.volatility_reference + delta_id * (constants::BASIS_POINT_MAX as u32);
        let max_vol_acc = self.max_volatility_accumulator;
        vol_acc = if vol_acc > max_vol_acc {
            max_vol_acc
        } else {
            vol_acc
        };
        self.volatility_accumulator = vol_acc;
    }

    fn update_id_reference(&mut self) {
        let active_id = self.active_index;
        self.index_reference = active_id;
    }

    fn update_volatility_reference(&mut self) {
        let vol_acc = self.volatility_accumulator;
        let reduction_factor = self.reduction_factor as u32;
        let vol_ref = full_math_u64::mul_div_floor(
            vol_acc as u64,
            reduction_factor as u64,
            constants::BASIS_POINT_MAX as u64,
        ) as u32;
        self.volatility_reference = vol_ref;
    }

    fn update_time_of_last_update(&mut self, timestamp: u64) {
        self.time_of_last_update = timestamp;
    }
}

mod full_math_u64 {
    // ref: https://github.com/CetusProtocol/integer-mate/blob/4d09c8ba0527274983c6664a5d5def2e784d4692/sui/sources/full_math_u64.move#L2-L5
    pub fn mul_div_floor(num1: u64, num2: u64, denom: u64) -> u64 {
        let r = (num1 as u128 * num2 as u128) / (denom as u128);
        r as u64
    }
}

mod bin {
    use crate::{constants, u128x128};

    use super::{fee, price, uint_safe};
    use alloy_primitives::U256;

    pub fn get_amounts(
        reserve_x: u64,
        reserve_y: u64,
        bin_step: u16,
        total_fee: u64,
        swap_for_y: bool,
        active_id: u32,
        amount_in_left: u64,
    ) -> (u64, u64, u64, u64, u64, u64) {
        let bin_price_q128 = price::get_price_x128_from_storage_id(active_id, bin_step);

        let bin_reserve_out = if swap_for_y { reserve_y } else { reserve_x };
        let max_amount_in = if swap_for_y {
            uint_safe::safe64(u128x128::to_u128x128(bin_reserve_out as u128, 0) / bin_price_q128)
        } else {
            let (amount, _) = u128x128::from_u128x128(U256::from(bin_reserve_out) * bin_price_q128);
            uint_safe::safe64(U256::from(amount))
        };

        let max_fee = fee::get_fee_amount(max_amount_in, total_fee);
        let max_amount_in = max_amount_in + max_fee;

        let (fee, amount_in, amount_out) = if amount_in_left >= max_amount_in {
            (max_fee, max_amount_in, bin_reserve_out)
        } else {
            let fee = fee::get_fee_amount_from(amount_in_left, total_fee);
            let amount_in = amount_in_left - fee;
            let mut amount_out = if swap_for_y {
                let (amount, _) = u128x128::from_u128x128(U256::from(amount_in) * bin_price_q128);
                uint_safe::safe64(U256::from(amount))
            } else {
                uint_safe::safe64(u128x128::to_u128x128(amount_in as u128, 0) / bin_price_q128)
            };
            if amount_out > bin_reserve_out {
                amount_out = bin_reserve_out;
            };
            (fee, amount_in, amount_out)
        };

        let (
            amounts_in_with_fees_x,
            amounts_in_with_fees_y,
            amounts_out_of_bin_x,
            amounts_out_of_bin_y,
            fee_x,
            fee_y,
        ) = if swap_for_y {
            assert!(
                get_liquidity(
                    reserve_x + amount_in,
                    reserve_y - amount_out,
                    bin_price_q128
                ) <= U256::from(constants::max_liquidity_per_bin()),
                "ErrMaxLiquidityPerBinExceeded"
            );
            (amount_in, 0, 0, amount_out, fee, 0)
        } else {
            assert!(
                get_liquidity(
                    reserve_x - amount_out,
                    reserve_y + amount_in,
                    bin_price_q128
                ) <= U256::from(constants::max_liquidity_per_bin()),
                "ErrMaxLiquidityPerBinExceeded"
            );
            (0, amount_in, amount_out, 0, 0, fee)
        };

        return (
            amounts_in_with_fees_x,
            amounts_in_with_fees_y,
            amounts_out_of_bin_x,
            amounts_out_of_bin_y,
            fee_x,
            fee_y,
        );
    }

    pub fn get_liquidity(amount_x: u64, amount_y: u64, price_q128: U256) -> U256 {
        let mut liquidity = U256::ZERO;
        if amount_x > 0 {
            liquidity = price_q128 * U256::from(amount_x);
            assert!(
                liquidity / U256::from(amount_x) == price_q128,
                "ErrLiquidityOverflow"
            );
        };
        if amount_y > 0 {
            let amount_y_256 = U256::from(amount_y) << constants::SCALE_OFFSET;
            liquidity = liquidity + amount_y_256;
            assert!(liquidity >= amount_y_256, "ErrLiquidityOverflow");
        };
        liquidity
    }
}

mod fee {
    use alloy_primitives::U256;

    use crate::constants;

    use super::uint_safe;

    pub fn get_fee_amount_from(amount_with_fees: u64, total_fee: u64) -> u64 {
        verify_fee(total_fee);

        // Can't overflow, max(result) = (type(uint128).max * 0.1e18 + 1e18 - 1) / 1e18 < 2^128
        let amount = (U256::from(amount_with_fees) * U256::from(total_fee)
            + U256::from(constants::PRECISION)
            - U256::from(1))
            / U256::from(constants::PRECISION);

        uint_safe::safe64(amount)
    }

    pub fn get_fee_amount(amount: u64, total_fee: u64) -> u64 {
        verify_fee(total_fee);

        let denominator = U256::from(constants::PRECISION as u64 - total_fee);
        // Can't overflow, max(result) = (type(uint128).max * 0.1e18 + (1e18 - 1)) / 0.9e18 < 2^128
        let amount = (U256::from(amount) * U256::from(total_fee) + denominator - U256::from(1))
            / denominator;

        uint_safe::safe64(amount)
    }

    pub fn verify_fee(fee: u64) {
        assert!(fee <= constants::MAX_FEE, "ErrFeeTooLarge");
    }
}
