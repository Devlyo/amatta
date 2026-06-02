// Post-framework setup (runs after the jest test framework — and `expect` —
// is installed). @testing-library/react-native's extend-expect requires
// `expect` to be defined, so it must be loaded here, not in `setupFiles`.
require('@testing-library/react-native');
