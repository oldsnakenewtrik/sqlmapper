/**
 * SQL Mapper Rule Engine
 *
 * This module provides a rule-based system for automatically mapping
 * original network and campaign names to pretty versions.
 */

// Rule Engine
const RuleEngine = {
    // Array of mapping rules
    rules: [
        // Rule 1: External Referrals
        {
            name: "External Referrals",
            condition: (row) => (row.source === 'Website' || row.source === 'Referral') &&
                               row.originalName && !row.originalName.includes('sondercare.com'),
            setPrettyNetwork: 'External Referral',
            setPrettyName: (row) => `Ref: ${row.originalName}`
        },

        // Rule 2: Google Ads
        {
            name: "Google Ads",
            condition: (row) => row.originalNetwork && ['google', 'adwords', 'googleads'].some(term =>
                row.originalNetwork.toLowerCase().includes(term)),
            setPrettyNetwork: 'Google Ads'
        },

        // Rule 3: Bing/Microsoft Ads
        {
            name: "Microsoft Ads",
            condition: (row) => row.originalNetwork && ['bing', 'microsoft'].some(term =>
                row.originalNetwork.toLowerCase().includes(term)),
            setPrettyNetwork: 'Microsoft Ads'
        },

        // Rule 4: Social Media Consolidation
        {
            name: "Social Media",
            condition: (row) => row.source === 'Social Network' ||
                (row.originalNetwork && ['facebook', 'instagram', 'linkedin', 'twitter'].some(term =>
                    row.originalNetwork.toLowerCase().includes(term))),
            setPrettyNetwork: 'Social Media',
            setPrettyName: (row) => {
                const network = row.originalNetwork || '';
                const platform = network.charAt(0).toUpperCase() + network.slice(1).toLowerCase();
                return `${platform} Post`;
            }
        },

        // Rule 5: Email Campaigns
        {
            name: "Email Marketing",
            condition: (row) => row.originalNetwork && ['klaviyo', 'email'].some(term =>
                row.originalNetwork.toLowerCase().includes(term)),
            setPrettyNetwork: 'Email Marketing'
        },

        // Rule 6: Direct Traffic
        {
            name: "Direct Traffic",
            condition: (row) => row.source === 'Website' && row.originalName && row.originalName.includes('sondercare.com'),
            setPrettyNetwork: 'Direct/Internal',
            setPrettyName: 'Direct/Internal'
        },

        // Rule 7: Organic Search
        {
            name: "Organic Search",
            condition: (row) => row.source === 'Search Engine' || row.source === 'Organic Search',
            setPrettyNetwork: 'Organic Search',
            setPrettyName: (row) => `Search: ${row.originalName || 'Unknown'}`
        },

        // Rule 8: RedTrack Campaigns with pipe separator
        {
            name: "RedTrack Campaigns with Pipe",
            condition: (row) => row.rtCampaign && row.rtCampaign.includes(' | '),
            setPrettyNetwork: (row) => {
                const parts = row.rtCampaign.split(' | ');
                return parts[0] || row.originalNetwork;
            },
            setPrettyName: (row) => {
                const parts = row.rtCampaign.split(' | ');
                return parts.length > 1 ? parts[1] : row.originalName;
            }
        },

        // Rule 9: Use RT Source for Network
        {
            name: "RT Source for Network",
            condition: (row) => row.rtSource && !row.prettyNetwork,
            setPrettyNetwork: (row) => row.rtSource
        },

        // Rule 10: Use RT Campaign for Name
        {
            name: "RT Campaign for Name",
            condition: (row) => row.rtCampaign && !row.prettyName,
            setPrettyName: (row) => row.rtCampaign
        }
    ],

    // Dictionary for exact matches (simpler than rules)
    dictionary: {
        networks: {
            'google': 'Google Ads',
            'adwords': 'Google Ads',
            'googleads': 'Google Ads',
            'google ads - shop/p': 'Google Ads',
            'google ads - s/d': 'Google Ads',
            'bing': 'Microsoft Ads',
            'bing ads': 'Microsoft Ads',
            'facebook': 'Social Media',
            'instagram': 'Social Media',
            'linkedin': 'Social Media',
            'twitter': 'Social Media',
            'klaviyo': 'Email Marketing',
            'email': 'Email Marketing',
            'sa360': 'Google Ads',
            'stackadapt': 'Display Ads',
            'organic / direct / no referrer': 'Direct/Internal',
            'organic search': 'Organic Search',
            'google ads': 'Google Ads',
            'google_ads': 'Google Ads',
            'facebook_ads': 'Social Media',
            'facebook ads': 'Social Media',
            'meta': 'Social Media',
            'meta ads': 'Social Media',
            'meta_ads': 'Social Media',
            'bing ads': 'Microsoft Ads',
            'bing_ads': 'Microsoft Ads',
            'microsoft ads': 'Microsoft Ads',
            'microsoft_ads': 'Microsoft Ads'
        }
    },

    // Apply rules to a single mapping
    applyRulesToMapping: function(mapping) {
        // First try dictionary lookup for network (exact match)
        const networkLower = mapping.originalNetwork ? mapping.originalNetwork.toLowerCase() : '';
        if (this.dictionary.networks[networkLower] && !mapping.prettyNetwork) {
            mapping.prettyNetwork = this.dictionary.networks[networkLower];
        }

        // Then apply rules
        for (const rule of this.rules) {
            if (rule.condition(mapping)) {
                // Apply network mapping if rule provides it and it's not already set
                if (rule.setPrettyNetwork && (!mapping.prettyNetwork || mapping.prettyNetwork === mapping.originalNetwork)) {
                    mapping.prettyNetwork = rule.setPrettyNetwork;
                }

                // Apply name mapping if rule provides it and it's not already set
                if (rule.setPrettyName && (!mapping.prettyName || mapping.prettyName === mapping.originalName)) {
                    if (typeof rule.setPrettyName === 'function') {
                        mapping.prettyName = rule.setPrettyName(mapping);
                    } else {
                        mapping.prettyName = rule.setPrettyName;
                    }
                }
            }
        }

        return mapping;
    },

    // Apply rules to all mappings
    applyRules: function(mappings) {
        return mappings.map(mapping => this.applyRulesToMapping(mapping));
    },

    // Get rule names for UI display
    getRuleNames: function() {
        return this.rules.map(rule => rule.name);
    },

    // Enable/disable specific rules
    toggleRule: function(ruleName, enabled) {
        const rule = this.rules.find(r => r.name === ruleName);
        if (rule) {
            rule.enabled = enabled;
        }
    },

    // Add a new rule
    addRule: function(rule) {
        this.rules.push(rule);
    },

    // Remove a rule
    removeRule: function(ruleName) {
        const index = this.rules.findIndex(r => r.name === ruleName);
        if (index !== -1) {
            this.rules.splice(index, 1);
        }
    },

    // Export rules to JSON
    exportRules: function() {
        return JSON.stringify(this.rules);
    },

    // Import rules from JSON
    importRules: function(rulesJson) {
        try {
            const parsedRules = JSON.parse(rulesJson);
            if (Array.isArray(parsedRules)) {
                this.rules = parsedRules;
                return true;
            }
        } catch (e) {
            console.error('Error importing rules:', e);
        }
        return false;
    }
};
