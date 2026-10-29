
export type {
    SendMailOptions,
    SendMailResult,
    MailAddress
} from "./types";

export type { OtpPurpose } from "./templates/otpTemplate";

export { getMailConfig } from "./config";
export { sendOtpEmail } from "./templates/sendOtpEmail";
export { mailer } from "./mailService";

/**
 * Copyright (c) 2026 Sobhan Rasoulzadeh Asl (Sobhan-SRZA / Mr. Sinre)
 *
 * Licensed under the BSD 3-Clause License.
 * See the LICENSE file in the project root for license information.
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */
