use std::net::SocketAddr;

use str0m::{Candidate, Rtc};

// Every address the manager found, not a guessed one: a sender on another
// machine can only reach us on an address its own route leads to.
pub fn add_host_candidates(rtc: &mut Rtc, candidates: &[SocketAddr]) -> Result<(), String> {
    for &address in candidates {
        let host = Candidate::host(address, "udp").map_err(|error| error.to_string())?;
        rtc.add_local_candidate(host);
    }
    Ok(())
}
