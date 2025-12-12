try {
    console.log('Loading userModel...');
    require('./src/models/userModel');
    console.log('userModel loaded.');

    console.log('Loading assignmentService...');
    require('./src/services/assignmentService');
    console.log('assignmentService loaded.');

    console.log('Loading leadController...');
    require('./src/controllers/leadController');
    console.log('leadController loaded.');
} catch (error) {
    console.error('Error loading modules:', error);
}
