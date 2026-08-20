# frozen_string_literal: true

require "psych"
require "yaml"

path = ARGV.fetch(0, "docs/openapi.yaml")

def validate_unique_mapping_keys(node, location = [])
  case node
  when Psych::Nodes::Mapping
    seen = {}
    node.children.each_slice(2) do |key, value|
      key_name = key.is_a?(Psych::Nodes::Scalar) ? key.value : "<complex-key>"
      if seen[key_name]
        abort "#{location.join("/")}: duplicate key #{key_name.inspect} at line #{key.start_line + 1}"
      end
      seen[key_name] = true
      validate_unique_mapping_keys(value, location + [key_name])
    end
  when Psych::Nodes::Sequence
    node.children.each_with_index do |child, index|
      validate_unique_mapping_keys(child, location + [index.to_s])
    end
  else
    Array(node.children).each { |child| validate_unique_mapping_keys(child, location) }
  end
end

syntax_tree = Psych.parse_file(path)
validate_unique_mapping_keys(syntax_tree)
document = YAML.safe_load_file(path, aliases: true)

abort "OpenAPI document must be an object" unless document.is_a?(Hash)
abort "unsupported OpenAPI version" unless document.fetch("openapi", "").start_with?("3.1.")

references = []
walk = lambda do |value|
  case value
  when Hash
    value.each do |key, child|
      references << child if key == "$ref"
      walk.call(child)
    end
  when Array
    value.each { |child| walk.call(child) }
  end
end
walk.call(document)

missing_references = references.filter_map do |reference|
  next unless reference.start_with?("#/")

  resolved = reference.delete_prefix("#/").split("/").reduce(document) do |parent, segment|
    key = segment.gsub("~1", "/").gsub("~0", "~")
    parent.is_a?(Hash) ? parent[key] : nil
  end
  reference unless resolved
end.uniq
abort "missing references: #{missing_references.join(", ")}" unless missing_references.empty?

http_methods = %w[get post put patch delete options head trace]
operation_ids = document.fetch("paths", {}).values.flat_map do |path_item|
  path_item.filter_map do |method, operation|
    operation["operationId"] if http_methods.include?(method) && operation.is_a?(Hash)
  end
end
duplicate_operations = operation_ids.tally.select { |_operation, count| count > 1 }.keys
abort "duplicate operationIds: #{duplicate_operations.join(", ")}" unless duplicate_operations.empty?

puts "OpenAPI OK: #{operation_ids.length} operations, #{references.length} references"
