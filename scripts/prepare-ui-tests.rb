require 'xcodeproj'

root = File.expand_path('..', __dir__)
project_dir = File.join(root, 'ios-app/ios/App')
project = Xcodeproj::Project.open(File.join(project_dir, 'App.xcodeproj'))
app = project.targets.find { |t| t.name == 'App' }
raise 'App target missing' unless app
target = project.targets.find { |t| t.name == 'LiteratureUITests' }
unless target
  target = project.new_target(:ui_test_bundle, 'LiteratureUITests', :ios, '15.0')
  group = project.main_group.new_group('LiteratureUITests', 'LiteratureUITests')
  target.source_build_phase.add_file_reference(group.new_file('GameTests.swift'))
  target.add_dependency(app)
  target.build_configurations.each do |config|
    config.build_settings['PRODUCT_NAME'] = '$(TARGET_NAME)'
    config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'io.github.yasuic.literature.uitests'
    config.build_settings['TEST_TARGET_NAME'] = 'App'
    config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
    config.build_settings['SWIFT_VERSION'] = '5.0'
    config.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
    config.build_settings['CODE_SIGN_STYLE'] = 'Automatic'
  end
  project.save
  scheme_path = File.join(project_dir, 'App.xcodeproj/xcshareddata/xcschemes/App.xcscheme')
  scheme = Xcodeproj::XCScheme.new(scheme_path)
  scheme.add_build_target(target, false)
  scheme.add_test_target(target)
  scheme.save_as(File.join(project_dir, 'App.xcodeproj'), 'App', true)
end
puts 'Native UI test target prepared.'
