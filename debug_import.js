try {
    console.log('Loading leadService...');
    require('./src/services/leadService');
    console.log('leadService loaded.');
} catch (error) {
    console.error('Error loading leadService:', error);
}
